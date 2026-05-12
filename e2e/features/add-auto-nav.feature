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

  # ── Device-lock / PWA background scenarios (#145) ────────────────────────────
  #
  # On a shared family tablet in PWA standalone mode, the device may be locked
  # immediately after one family member adds an item. The 5-second auto-navigate
  # timer is then suspended by iOS and fires the moment the screen is unlocked —
  # before the next user can interact. This yanks the app to a different collection
  # without the new user doing anything.

  Scenario: Auto-navigate is cancelled when the page goes to background (device locked)
    Given the search results respond with one Falcon set
    When I search for "Falcon"
    And I add the first search result
    And the device is locked (page visibility becomes "hidden")
    Then the auto-navigate timer is cancelled
    And I am NOT redirected even after 10 seconds in the background

  Scenario: Auto-navigate does not fire when the page returns from background without interaction
    Given the search results respond with one Falcon set
    When I search for "Falcon"
    And I add the first search result
    And the device is locked (page visibility becomes "hidden")
    And the device is unlocked (page visibility becomes "visible") without any touch or key interaction
    Then I am NOT redirected to the collection page
    # This is the #145 bug — currently FAILS: the timer fires on resume

  Scenario: Auto-navigate still fires normally when the page stays visible
    Given the search results respond with one Falcon set
    When I search for "Falcon"
    And I add the first search result
    And the page remains visible throughout
    Then I am redirected to the collection page within 7 seconds
    # Regression guard: fixing #145 must not break the normal auto-nav path
