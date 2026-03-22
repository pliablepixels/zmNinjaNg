package com.zoneminder.zmNinjaNG;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import android.app.Activity;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.List;

public class PipActivity extends Activity {

    private static final String TAG = "PipActivity";
    private static final String ACTION_PLAY_PAUSE = "play_pause";
    private static final int REQUEST_PLAY_PAUSE = 1;

    private ExoPlayer player;
    private PlayerView playerView;
    private boolean pipEntered = false;
    private Rational aspectRatio;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Remove window background so the PlayerView surface is visible in PiP
        getWindow().setBackgroundDrawable(null);
        getWindow().getDecorView().setBackgroundColor(0xFF000000);

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(0xFF000000);
        playerView.setUseController(false); // Hide controls in PiP
        setContentView(playerView);

        String url = getIntent().getStringExtra("url");
        long position = getIntent().getLongExtra("position", 0);
        String aspectRatioStr = getIntent().getStringExtra("aspectRatio");

        Log.d(TAG, "onCreate url=" + url + " position=" + position);

        if (url == null) {
            Log.e(TAG, "No URL provided");
            setResult(RESULT_CANCELED);
            finish();
            return;
        }

        aspectRatio = parseAspectRatio(aspectRatioStr);

        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        MediaItem mediaItem = new MediaItem.Builder()
                .setUri(url)
                .setMimeType(MimeTypes.VIDEO_MP4)
                .build();
        player.setMediaItem(mediaItem);
        player.prepare();
        player.seekTo(position);
        player.setPlayWhenReady(true);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                Log.d(TAG, "playbackState=" + playbackState);
                if (playbackState == Player.STATE_ENDED) {
                    finishWithPosition();
                }
            }

            @Override
            public void onRenderedFirstFrame() {
                Log.d(TAG, "First frame rendered, entering PiP");
                enterPipMode();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                // Update PiP action icon when play state changes
                updatePipActions();
            }

            @Override
            public void onPlayerError(@NonNull androidx.media3.common.PlaybackException error) {
                Log.e(TAG, "Player error: " + error.getMessage(), error);
                finishWithPosition();
            }
        });

        // Set PiP params (but do NOT auto-enter — we enter manually after first frame)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio);
            setPictureInPictureParams(pipBuilder.build());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle PiP control actions via activity intent
        if (intent != null && ACTION_PLAY_PAUSE.equals(intent.getAction()) && player != null) {
            Log.d(TAG, "onNewIntent: play/pause toggle");
            if (player.isPlaying()) {
                player.pause();
            } else {
                player.play();
            }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode,
                                               @NonNull Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);

        if (!isInPictureInPictureMode) {
            finishWithPosition();
        }
    }

    private void enterPipMode() {
        if (pipEntered) return;
        pipEntered = true;
        Log.d(TAG, "enterPipMode");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .setActions(buildPipActions());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                pipBuilder.setAutoEnterEnabled(true);
            }
            enterPictureInPictureMode(pipBuilder.build());
        }
    }

    private void updatePipActions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && pipEntered) {
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                    .setActions(buildPipActions());
            setPictureInPictureParams(pipBuilder.build());
        }
    }

    private List<RemoteAction> buildPipActions() {
        List<RemoteAction> actions = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean isPlaying = player != null && player.isPlaying();
            int iconRes = isPlaying
                    ? android.R.drawable.ic_media_pause
                    : android.R.drawable.ic_media_play;
            String title = isPlaying ? "Pause" : "Play";

            // Use an explicit activity intent instead of broadcast
            Intent intent = new Intent(this, PipActivity.class);
            intent.setAction(ACTION_PLAY_PAUSE);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this, REQUEST_PLAY_PAUSE, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            RemoteAction action = new RemoteAction(
                    Icon.createWithResource(this, iconRes),
                    title, title, pendingIntent);
            actions.add(action);
        }
        return actions;
    }

    private void finishWithPosition() {
        long pos = player != null ? player.getCurrentPosition() : 0;
        Log.d(TAG, "finishWithPosition pos=" + pos);
        Intent resultIntent = new Intent();
        resultIntent.putExtra("position", pos);
        setResult(RESULT_OK, resultIntent);
        finish();
    }

    private Rational parseAspectRatio(String ratioStr) {
        if (ratioStr != null && ratioStr.contains(":")) {
            try {
                String[] parts = ratioStr.split(":");
                return new Rational(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
            } catch (Exception ignored) {}
        }
        return new Rational(16, 9);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
