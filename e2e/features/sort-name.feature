Feature: Vinyl sort name field (#120)
  An editor can set a manual sort name on a vinyl item so it sorts and
  groups by last name even when not fetched from Discogs.
  The field is only shown for vinyl — books and comics use automatic
  last-name extraction.

  Background:
    Given I am authenticated as an editor

  Scenario: Sort name input is shown when editing a vinyl item
    Given I am on Alice's vinyl collection page
    When I open the first item
    And I tap the edit button
    Then I see the sort name field

  Scenario: Sort name input is NOT shown when editing a book
    Given I am on Alice's book collection page
    When I open the first item
    And I tap the edit button
    Then I do not see the sort name field

  Scenario: Saving a sort name sends it to the PATCH API
    Given the PATCH items API is mocked
    And I am on Alice's vinyl collection page
    When I open the first item
    And I tap the edit button
    And I fill in the sort name "Beatles, The"
    And I save the edit
    Then the PATCH request includes sort name "Beatles, The"
