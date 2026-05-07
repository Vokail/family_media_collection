Feature: Login screen
  Visitors must authenticate before they can browse the family collection.

  Scenario: The login page renders the password field and Enter button
    When I visit the login page
    Then I see the password field
    And I see the "Enter" button

  Scenario: An incorrect password keeps the user on the login screen
    Given I am on the login page
    When I enter the password "definitely-wrong"
    And I press the "Enter" button
    Then I stay on the login screen
