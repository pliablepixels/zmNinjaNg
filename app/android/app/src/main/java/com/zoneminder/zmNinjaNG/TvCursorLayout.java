package com.zoneminder.zmNinjaNG;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PointF;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.webkit.WebView;
import android.widget.FrameLayout;

/**
 * FrameLayout that overlays a virtual cursor on its child (WebView).
 * D-pad moves the cursor, center/enter dispatches touch events.
 * Based on patterns from TV Bro browser.
 */
public class TvCursorLayout extends FrameLayout {

    private final PointF cursorPos = new PointF();
    private final PointF cursorSpeed = new PointF(0, 0);
    private final PointF direction = new PointF(0, 0);

    private float maxSpeed;
    private float cursorRadius;
    private float scrollPadding;
    private boolean cursorVisible = false;
    private boolean cursorPressed = false;
    private long downTime = 0;
    private long lastHideTime = 0;

    private static final long HIDE_TIMEOUT = 5000;
    private static final float ACCEL = 0.05f;
    private static final float DEAD_ZONE = 0.1f;

    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    // Track last direction to prevent stuck keys
    private int lastDpadKeyCode = 0;

    private final Runnable updateRunnable = new Runnable() {
        @Override
        public void run() {
            long now = SystemClock.uptimeMillis();

            // Auto-hide after timeout
            if (cursorVisible && direction.x == 0 && direction.y == 0
                    && cursorSpeed.length() < DEAD_ZONE
                    && now - lastHideTime > HIDE_TIMEOUT) {
                cursorVisible = false;
                invalidate();
                return;
            }

            float dTime = 16f; // assume ~60fps
            float accel = ACCEL * dTime;

            // Accelerate in direction
            cursorSpeed.x += direction.x * accel;
            cursorSpeed.y += direction.y * accel;

            // Clamp to max speed
            cursorSpeed.x = Math.max(-maxSpeed, Math.min(maxSpeed, cursorSpeed.x));
            cursorSpeed.y = Math.max(-maxSpeed, Math.min(maxSpeed, cursorSpeed.y));

            // Decelerate when no direction
            if (direction.x == 0) {
                cursorSpeed.x = 0;
            }
            if (direction.y == 0) {
                cursorSpeed.y = 0;
            }

            // Dead zone snap
            if (Math.abs(cursorSpeed.x) < DEAD_ZONE) cursorSpeed.x = 0;
            if (Math.abs(cursorSpeed.y) < DEAD_ZONE) cursorSpeed.y = 0;

            // Move cursor
            if (cursorSpeed.x != 0 || cursorSpeed.y != 0) {
                cursorPos.x = Math.max(0, Math.min(getWidth() - 1, cursorPos.x + cursorSpeed.x));
                cursorPos.y = Math.max(0, Math.min(getHeight() - 1, cursorPos.y + cursorSpeed.y));
                lastHideTime = now;

                // Edge scroll
                handleEdgeScroll();
            }

            invalidate();

            // Keep running if cursor is visible and moving or waiting to hide
            if (cursorVisible) {
                post(this);
            }
        }
    };

    public TvCursorLayout(Context context) {
        super(context);
        init();
    }

    public TvCursorLayout(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        setWillNotDraw(false);
        int displayWidth = getResources().getDisplayMetrics().widthPixels;
        maxSpeed = displayWidth / 25f;
        cursorRadius = displayWidth / 80f;
        scrollPadding = displayWidth / 15f;

        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(Color.argb(160, 0, 168, 255)); // match app's #00a8ff

        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeWidth(2f);
        strokePaint.setColor(Color.argb(200, 255, 255, 255));
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        boolean isDown = event.getAction() == KeyEvent.ACTION_DOWN;

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                return handleDirectionKey(keyCode, isDown);

            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                return handleSelectKey(isDown);

            case KeyEvent.KEYCODE_BACK:
                if (isDown) {
                    View child = getChildAt(0);
                    if (child instanceof WebView) {
                        WebView webView = (WebView) child;
                        if (webView.canGoBack()) {
                            webView.goBack();
                        }
                    }
                }
                return true; // Always consume — use Home to exit

            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private boolean handleDirectionKey(int keyCode, boolean isDown) {
        if (isDown) {
            // Show cursor if hidden; first press just shows, doesn't move
            if (!cursorVisible) {
                showCursor();
                return true;
            }

            // Release old direction before setting new (prevents stuck keys)
            if (lastDpadKeyCode != 0 && lastDpadKeyCode != keyCode) {
                releaseDirection(lastDpadKeyCode);
            }
            lastDpadKeyCode = keyCode;

            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_UP:    direction.y = -1; break;
                case KeyEvent.KEYCODE_DPAD_DOWN:  direction.y = 1; break;
                case KeyEvent.KEYCODE_DPAD_LEFT:  direction.x = -1; break;
                case KeyEvent.KEYCODE_DPAD_RIGHT: direction.x = 1; break;
            }
        } else {
            releaseDirection(keyCode);
            if (keyCode == lastDpadKeyCode) lastDpadKeyCode = 0;
        }
        return true;
    }

    private void releaseDirection(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
                direction.y = 0;
                cursorSpeed.y = 0;
                break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                direction.x = 0;
                cursorSpeed.x = 0;
                break;
        }
        // End scroll gesture when all directions released
        if (direction.x == 0 && direction.y == 0) {
            View child = getChildAt(0);
            if (child != null) endScrollGesture(child);
        }
    }

    private boolean handleSelectKey(boolean isDown) {
        if (!cursorVisible) {
            showCursor();
            return true;
        }

        if (isDown && !cursorPressed) {
            cursorPressed = true;
            downTime = SystemClock.uptimeMillis();
            dispatchTouchToChild(MotionEvent.ACTION_DOWN);
            invalidate();
        } else if (!isDown && cursorPressed) {
            cursorPressed = false;
            dispatchTouchToChild(MotionEvent.ACTION_UP);
            invalidate();
        }
        return true;
    }

    private void dispatchTouchToChild(int action) {
        long now = SystemClock.uptimeMillis();
        if (action == MotionEvent.ACTION_DOWN) {
            downTime = now;
        }

        MotionEvent.PointerProperties[] props = new MotionEvent.PointerProperties[1];
        props[0] = new MotionEvent.PointerProperties();
        props[0].id = 0;
        props[0].toolType = MotionEvent.TOOL_TYPE_FINGER;

        MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[1];
        coords[0] = new MotionEvent.PointerCoords();
        coords[0].x = cursorPos.x;
        coords[0].y = cursorPos.y;
        coords[0].pressure = 1f;
        coords[0].size = 1f;

        MotionEvent event = MotionEvent.obtain(
                downTime, now, action, 1, props, coords,
                0, 0, 1f, 1f, 0, 0, 0, 0
        );

        // Dispatch to child views (the WebView)
        View child = getChildAt(0);
        if (child != null) {
            child.dispatchTouchEvent(event);
        }
        event.recycle();
    }

    // Scroll gesture state
    private boolean scrollGestureActive = false;
    private final PointF scrollTouchStart = new PointF();
    private final PointF scrollTouchCurrent = new PointF();
    private long scrollDownTime = 0;
    private static final float SCROLL_INSET = 300f;

    private void handleEdgeScroll() {
        View child = getChildAt(0);
        if (child == null) return;

        float scrollSpeed = Math.max(Math.abs(cursorSpeed.x), Math.abs(cursorSpeed.y));
        if (scrollSpeed < 1) {
            endScrollGesture(child);
            return;
        }

        float scrollDx = 0, scrollDy = 0;

        // Check if cursor is near edges
        if (cursorPos.y < scrollPadding) {
            scrollDy = -scrollSpeed * 0.8f;
        } else if (cursorPos.y > getHeight() - scrollPadding) {
            scrollDy = scrollSpeed * 0.8f;
        }
        if (cursorPos.x < scrollPadding) {
            scrollDx = -scrollSpeed * 0.8f;
        } else if (cursorPos.x > getWidth() - scrollPadding) {
            scrollDx = scrollSpeed * 0.8f;
        }

        if (scrollDx == 0 && scrollDy == 0) {
            endScrollGesture(child);
            return;
        }

        // Synthesize a touch drag gesture so CSS overflow scrolling works
        if (!scrollGestureActive) {
            // Start a new drag gesture from center of screen
            scrollGestureActive = true;
            scrollDownTime = SystemClock.uptimeMillis();
            float startX = Math.max(SCROLL_INSET, Math.min(getWidth() - SCROLL_INSET, getWidth() / 2f));
            float startY = Math.max(SCROLL_INSET, Math.min(getHeight() - SCROLL_INSET, getHeight() / 2f));
            scrollTouchStart.set(startX, startY);
            scrollTouchCurrent.set(startX, startY);
            dispatchSyntheticTouch(child, MotionEvent.ACTION_DOWN, scrollTouchCurrent.x, scrollTouchCurrent.y, scrollDownTime);
        }

        // Move the fake touch point opposite to scroll direction
        scrollTouchCurrent.x -= scrollDx;
        scrollTouchCurrent.y -= scrollDy;

        // If touch point drifts too far, restart the gesture
        float dx = scrollTouchCurrent.x - scrollTouchStart.x;
        float dy = scrollTouchCurrent.y - scrollTouchStart.y;
        if (Math.abs(dx) > SCROLL_INSET - 50 || Math.abs(dy) > SCROLL_INSET - 50) {
            // Cancel and restart
            dispatchSyntheticTouch(child, MotionEvent.ACTION_CANCEL, scrollTouchCurrent.x, scrollTouchCurrent.y, scrollDownTime);
            scrollGestureActive = false;
            return;
        }

        dispatchSyntheticTouch(child, MotionEvent.ACTION_MOVE, scrollTouchCurrent.x, scrollTouchCurrent.y, scrollDownTime);
    }

    private void endScrollGesture(View child) {
        if (scrollGestureActive) {
            dispatchSyntheticTouch(child, MotionEvent.ACTION_UP, scrollTouchCurrent.x, scrollTouchCurrent.y, scrollDownTime);
            scrollGestureActive = false;
        }
    }

    private void dispatchSyntheticTouch(View target, int action, float x, float y, long downTime) {
        long now = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties[] props = new MotionEvent.PointerProperties[1];
        props[0] = new MotionEvent.PointerProperties();
        props[0].id = 1; // Use different pointer ID than cursor clicks (id=0)
        props[0].toolType = MotionEvent.TOOL_TYPE_FINGER;

        MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[1];
        coords[0] = new MotionEvent.PointerCoords();
        coords[0].x = x;
        coords[0].y = y;
        coords[0].pressure = 1f;
        coords[0].size = 1f;

        MotionEvent event = MotionEvent.obtain(downTime, now, action, 1, props, coords,
                0, 0, 1f, 1f, 1, 0, 0, 0);
        target.dispatchTouchEvent(event);
        event.recycle();
    }

    private void showCursor() {
        cursorVisible = true;
        lastHideTime = SystemClock.uptimeMillis();
        if (cursorPos.x == 0 && cursorPos.y == 0) {
            cursorPos.set(getWidth() / 2f, getHeight() / 2f);
        }
        removeCallbacks(updateRunnable);
        post(updateRunnable);
        invalidate();
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        super.dispatchDraw(canvas);

        if (!cursorVisible) return;

        float r = cursorPressed ? cursorRadius * 0.7f : cursorRadius;
        canvas.drawCircle(cursorPos.x, cursorPos.y, r, fillPaint);
        canvas.drawCircle(cursorPos.x, cursorPos.y, r, strokePaint);
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        removeCallbacks(updateRunnable);
    }
}
