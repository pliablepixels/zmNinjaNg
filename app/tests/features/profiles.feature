Feature: Profile Management
  As a ZoneMinder user
  I want to manage multiple server profiles
  So that I can connect to different ZoneMinder instances

  Background:
    Given I am logged into zmNinjaNg
    When I navigate to the "Profiles" page

  @all
  Scenario: Profile list shows profiles with correct names
    Then I should see at least 1 profile cards

  @all
  Scenario: Active profile has a visible indicator
    Then I should see the active profile indicator

  @all
  Scenario: Edit profile form shows current values and saves changes
    When I open the edit dialog for the first profile
    Then I should see the profile edit dialog
    When I change the profile name to a new value
    And I save profile edits
    Then the updated profile name should appear in the list

  @all
  Scenario: Add profile with connection details
    When I click the add profile button
    Then I should see the profile form
    When I fill in new profile connection details
    And I save the new profile
    Then I should see the new profile in the list

  @all
  Scenario: Delete profile after confirmation
    When I open the delete dialog for the first profile if possible
    Then I should see the profile delete dialog
    When I cancel profile deletion
    Then I should see the profiles list

  @ios-phone @android @visual
  Scenario: Phone layout stacks profile cards
    Given the viewport is mobile size
    Then I should see at least 1 profile cards
    And no element should overflow the viewport horizontally
    And the page should match the visual baseline
