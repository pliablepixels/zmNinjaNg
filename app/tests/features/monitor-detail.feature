Feature: Monitor Detail Page
  As a ZoneMinder user viewing a monitor
  I want to interact with the live feed and controls
  So that I can manage cameras and capture snapshots

  Background:
    Given I am logged into zmNinjaNG
    When I navigate to the "Monitors" page
    And I click into the first monitor detail page

  @all
  Scenario: Video player loads with a connected feed
    Then I should see the monitor player
    And I should see a video player element

  @all
  Scenario: Snapshot button downloads an image
    Then I should see the monitor player
    When I click the snapshot button in monitor detail
    Then I should see snapshot download initiated

  @all
  Scenario: Zone overlay toggle shows and hides zones
    Then I should see the zone toggle button
    When I click the zone toggle button
    Then the zone toggle should be active
    When I click the zone toggle button
    Then the zone toggle should be inactive

  @all
  Scenario: Navigation arrows cycle through monitors
    Then I should see navigation arrows if multiple monitors exist
    When I click the next monitor button if visible
    Then the monitor should change to next in list
    When I click the previous monitor button if visible
    Then the monitor should change to previous in list

  @all
  Scenario: Mode dropdown shows current mode
    Then I should see the monitor mode dropdown
    And the current mode should be displayed

  @all
  Scenario: Settings dialog opens and closes
    When I open the monitor settings dialog
    Then I should see the monitor settings dialog
    When I press Escape key
    Then the dialog should close

  @all
  Scenario: Settings dialog closes on backdrop tap
    When I click the settings button
    Then I should see the monitor settings dialog
    When I click outside the dialog
    Then the dialog should close

  @ios-phone @android @visual
  Scenario: Phone layout stacks controls below video
    Given the viewport is mobile size
    Then I should see the monitor player
    And no element should overflow the viewport horizontally
    And the page should match the visual baseline
