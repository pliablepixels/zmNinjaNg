Feature: Application Settings
  As a ZoneMinder user
  I want to configure application settings
  So that I can customize the app to my preferences

  Background:
    Given I am logged into zmNinjaNg

  @all
  Scenario: Toggle theme and verify background color changes
    When I navigate to the "Settings" page
    Then I should see theme selector
    When I toggle the theme
    Then the app background color should change
    When I navigate to the "Dashboard" page
    And I navigate to the "Settings" page
    Then the theme selection should persist

  @all
  Scenario: Change language and verify visible text updates
    When I navigate to the "Settings" page
    Then I should see language selector
    When I change the language to a different option
    Then a visible menu item should change to the selected language

  @all
  Scenario: Notification toggle persists across navigation
    When I navigate to the "Notifications" page
    Then I should see notification interface elements
    When I toggle a notification setting
    And I navigate to the "Dashboard" page
    And I navigate to the "Notifications" page
    Then the notification toggle state should be preserved

  @all
  Scenario: Server info shows version and system data
    When I navigate to the "Server" page
    Then I should see server information displayed

  @all
  Scenario: Log viewer filters by level and clears entries
    When I navigate to the "Logs" page
    Then I should see log entries or empty state
    And I should see log control elements
    And I change the log level to "WARN"
    And I clear logs if available

  @all
  Scenario: Bandwidth mode switch updates the mode label
    When I navigate to the "Settings" page
    When I toggle bandwidth mode
    Then the bandwidth mode label should update

  @ios-phone @android @visual
  Scenario: Phone layout makes all settings reachable via scroll
    Given the viewport is mobile size
    When I navigate to the "Settings" page
    Then I should see settings interface elements
    And no element should overflow the viewport horizontally
    And the page should match the visual baseline
