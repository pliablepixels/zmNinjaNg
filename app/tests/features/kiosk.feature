Feature: Kiosk Mode
  As a ZoneMinder user
  I want to lock the app with a PIN
  So that unauthorized people cannot navigate away from the current view

  Background:
    Given I am logged into zmNinjaNg
    When I navigate to the "Monitors" page

  @all
  Scenario: Set PIN and verify overlay blocks navigation
    When I click the sidebar kiosk lock button
    And I set a 4-digit PIN "1234"
    And I confirm the PIN "1234"
    Then the kiosk overlay should be visible
    And the sidebar should not be visible

  @all
  Scenario: Correct PIN unlocks the overlay
    Given kiosk mode is active with PIN "1234"
    When I click the kiosk unlock button
    And I enter the PIN "1234"
    Then the kiosk overlay should not be visible

  @all
  Scenario: Wrong PIN shows error and overlay stays
    Given kiosk mode is active with PIN "1234"
    When I click the kiosk unlock button
    And I enter the PIN "0000"
    Then I should see "Incorrect PIN"
    And the kiosk overlay should be visible

  @all
  Scenario: PIN mismatch during setup shows validation error
    When I click the sidebar kiosk lock button
    And I set a 4-digit PIN "1234"
    And I confirm the PIN "5678"
    Then I should see "PINs do not match"

  @ios-phone @android @ios-tablet @visual
  Scenario: Kiosk overlay covers full screen on all devices
    Given kiosk mode is active with PIN "1234"
    Then the kiosk overlay should cover the full viewport
    And the page should match the visual baseline
