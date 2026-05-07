Feature: Members page
  Once authenticated, the user picks which family member's collection to browse.

  Scenario: The members page lists every family member
    Given I am authenticated as an editor
    When I visit the members page
    Then I see the member "Alice"
    And I see the member "Bob"
    And I see the member "Charlie"
    And I see the member "Dana"
