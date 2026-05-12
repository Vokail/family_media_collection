Feature: Item Detail Sheet
  As a family member browsing the collection
  I want to tap an item card and see its full details in a bottom sheet
  So that I can read notes, metadata, and manage the item without leaving the collection grid

  Background:
    Given I am logged in
    And I am viewing "Alice"'s vinyl collection

  # ── Opening and closing ──────────────────────────────────────────────────────

  Scenario: Opening the detail sheet by tapping an item card
    Given the collection contains the vinyl record "Dark Side of the Moon" by "Pink Floyd"
    When I tap the item card for "Dark Side of the Moon"
    Then a detail sheet slides up from the bottom of the screen
    And the sheet displays the title "Dark Side of the Moon"
    And the sheet displays the creator "Pink Floyd"

  Scenario: Closing the sheet via the close button
    Given the detail sheet for "Dark Side of the Moon" is open
    When I tap the close button in the sheet
    Then the detail sheet is dismissed
    And I am returned to the collection grid

  Scenario: Closing the sheet by tapping the backdrop
    Given the detail sheet for "Dark Side of the Moon" is open
    When I tap outside the sheet on the backdrop overlay
    Then the detail sheet is dismissed

  # ── Viewer access ────────────────────────────────────────────────────────────

  Scenario: Viewer sees notes but cannot edit them
    Given I am logged in as a viewer
    And the item "Dark Side of the Moon" has the note "A classic — plays beautifully"
    When I open the detail sheet for "Dark Side of the Moon"
    Then I see the note "A classic — plays beautifully"
    But I do not see a notes input field
    And I do not see an Edit button

  Scenario: Viewer cannot delete an item
    Given I am logged in as a viewer
    When I open the detail sheet for "Dark Side of the Moon"
    Then I do not see a Delete button

  # ── Editor access ────────────────────────────────────────────────────────────

  Scenario: Editor can save a new note
    Given I am logged in as an editor
    And the item "Dark Side of the Moon" has no note
    When I open the detail sheet for "Dark Side of the Moon"
    And I type "One of the best records ever made" into the notes field
    And I tap "Save note"
    Then the note "One of the best records ever made" is saved
    And a success toast appears

  Scenario: Editor can toggle an item from owned to wishlist
    Given I am logged in as an editor
    And "Dark Side of the Moon" is in the Owned tab
    When I open the detail sheet for "Dark Side of the Moon"
    And I tap "Move to Wishlist"
    Then "Dark Side of the Moon" no longer appears in the Owned tab
    And "Dark Side of the Moon" now appears in the Wishlist tab

  Scenario: Editor sees a confirmation prompt before deleting
    Given I am logged in as an editor
    When I open the detail sheet for "Dark Side of the Moon"
    And I tap the Delete button
    Then a confirmation dialog appears asking "Delete this item?"
    And the item is NOT yet deleted

  Scenario: Confirming deletion removes the item from the grid
    Given I am logged in as an editor
    And the detail sheet for "Dark Side of the Moon" is open
    When I confirm the delete action
    Then "Dark Side of the Moon" is removed from the collection grid
    And the detail sheet is dismissed

  # ── Metadata display ─────────────────────────────────────────────────────────

  Scenario: Sheet shows year and cover image when available
    Given the item "Dark Side of the Moon" has year "1973" and a cover image
    When I open the detail sheet for "Dark Side of the Moon"
    Then the sheet shows the year "1973"
    And the cover image is displayed at the top of the sheet
