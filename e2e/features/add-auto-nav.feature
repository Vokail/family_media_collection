Feature: Add page auto-navigate cancellation (#121)
  After adding an item, the page schedules a 5-second auto-navigate back to the
  collection. The user expects this to be cancelled the moment they start
  adding another item — otherwise they get yanked away mid-edit.

  Background:
    Given I am authenticated as an editor
    And I am on the Lego add page

  Scenario: Starting a new search cancels the auto-navigate
    Given the search results respond with one Falcon set
    When I search for "Falcon"
    And I add the first search result
    And I start typing a new search "Star Destroyer"
    Then I am still on the add page after 6 seconds

  Scenario: Doing nothing lets the auto-navigate fire after 5 seconds
    Given the search results respond with one Falcon set
    When I search for "Falcon"
    And I add the first search result
    Then I am redirected to the collection page within 7 seconds
