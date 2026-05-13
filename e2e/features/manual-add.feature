Feature: Manual add form (#132)
  Editors can add items that aren't found in any database by filling in details
  manually. The form is collapsed by default and expands on demand. When a barcode
  or ISBN scan finds nothing, the form opens automatically with the code pre-filled.

  Background:
    Given I am authenticated as an editor
    And I am on Alice's book add page

  Scenario: Manual form is hidden by default
    Then I do not see the manual entry form

  Scenario: Toggling the form open and closed
    When I click "Not found? Add manually"
    Then I see the manual entry form
    When I click "Hide manual entry"
    Then I do not see the manual entry form

  Scenario: Submitting the form adds the item and shows a toast
    When I click "Not found? Add manually"
    And I fill in the manual title "Dune"
    And I fill in the manual creator "Frank Herbert"
    And I submit the manual form as "owned"
    Then I see a success toast

  Scenario: Adding to wishlist via the manual form
    When I click "Not found? Add manually"
    And I fill in the manual title "Foundation"
    And I submit the manual form as "wishlist"
    Then I see a success toast

  Scenario: Title is required — buttons disabled when title is empty
    When I click "Not found? Add manually"
    Then the manual submit buttons are disabled
