Feature: Monitor Group Filtering
  As a ZoneMinder user
  I want to filter monitors by group
  So that I can focus on specific camera groups

  Background:
    Given I am logged into zmNinjaNg

  @all
  Scenario: Select group filters monitors on the Monitors page
    When I navigate to the "Monitors" page
    And I select a group from the filter if available
    Then the filter should be applied

  @all
  Scenario: Clear group filter restores all monitors
    When I navigate to the "Monitors" page
    And I select a group from the filter if available
    When I clear the group filter if available
    Then all monitors should be visible again

  @all
  Scenario: Group filter persists across page navigation
    When I navigate to the "Monitors" page
    And I select a group from the filter if available
    When I navigate to the "Events" page
    And I navigate to the "Monitors" page
    Then the group filter selection should persist

  @ios-phone @android @visual
  Scenario: Phone group filter dropdown is tappable without overflow
    Given the viewport is mobile size
    When I navigate to the "Monitors" page
    Then I should see the group filter if groups are available
    And no element should overflow the viewport horizontally
