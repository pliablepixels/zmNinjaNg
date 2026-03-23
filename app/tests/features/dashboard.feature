Feature: Dashboard Customization
  As a ZoneMinder user
  I want to customize my dashboard with widgets
  So that I can see the information I care about at a glance

  Background:
    Given I am logged into zmNinjaNG
    When I navigate to the "Dashboard" page

  @all
  Scenario: Add a timeline widget and verify it displays data
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Test Timeline"
    And I click the Add button in the dialog
    Then the widget "Test Timeline" should appear on the dashboard
    And the widget should contain non-empty content

  @all
  Scenario: Add a monitor widget and verify live feed
    When I open the Add Widget dialog
    And I select the "Monitor Stream" widget type
    And I select the first monitor in the widget dialog
    And I enter widget title "Test Monitor"
    And I click the Add button in the dialog
    Then the widget "Test Monitor" should appear on the dashboard
    And the widget should contain non-empty content

  @all
  Scenario: Add an events widget and verify event data
    When I open the Add Widget dialog
    And I select the "Events" widget type
    And I enter widget title "Recent Events"
    And I click the Add button in the dialog
    Then the widget "Recent Events" should appear on the dashboard
    And the widget should contain non-empty content

  @all
  Scenario: Edit a widget title and verify it persists
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Original Title"
    And I click the Add button in the dialog
    Then the widget "Original Title" should appear on the dashboard
    When I enter dashboard edit mode
    And I click the widget edit button on the first widget
    Then I should see the widget edit dialog
    When I change the widget title to "Updated Title"
    And I save the widget changes
    Then the widget "Updated Title" should appear on the dashboard

  @all
  Scenario: Delete a widget and verify it disappears
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Widget To Delete"
    And I click the Add button in the dialog
    Then the widget "Widget To Delete" should appear on the dashboard
    When I enter dashboard edit mode
    And I click the widget delete button on the first widget
    Then the widget should be removed from the dashboard

  @all
  Scenario: Add multiple widget types in sequence
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Timeline 1"
    And I click the Add button in the dialog
    Then the widget "Timeline 1" should appear on the dashboard
    When I open the Add Widget dialog
    And I select the "Events" widget type
    And I enter widget title "Recent Events"
    And I click the Add button in the dialog
    Then the widget "Recent Events" should appear on the dashboard
    When I open the Add Widget dialog
    And I select the "Event Heatmap" widget type
    And I enter widget title "Heatmap"
    And I click the Add button in the dialog
    Then the widget "Heatmap" should appear on the dashboard

  @ios-phone @android @visual
  Scenario: Phone layout stacks widgets single-column with no overflow
    Given the viewport is mobile size
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Phone Widget"
    And I click the Add button in the dialog
    Then the widget "Phone Widget" should appear on the dashboard
    And no element should overflow the viewport horizontally
    And the page should match the visual baseline

  @ios-tablet @visual
  Scenario: Tablet layout shows widgets in multi-column grid
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Tablet Widget"
    And I click the Add button in the dialog
    Then the widget "Tablet Widget" should appear on the dashboard
    And the page should match the visual baseline
