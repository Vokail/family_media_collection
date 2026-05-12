Feature: Vinyl Record Condition Grading
  As a vinyl collector
  I want to record the physical condition of each record
  So that I can track quality, sort by grade, and spot records that need replacement

  Background:
    Given I am logged in
    And I am viewing a member's vinyl collection

  # ── Grading a record ─────────────────────────────────────────────────────────

  Scenario: Editor grades a record as Mint
    Given I am logged in as an editor
    And the record "Kind of Blue" has no condition set
    When I open the detail sheet for "Kind of Blue"
    And I tap the "M" condition button
    Then the condition badge on the item card shows "M"
    And a success toast appears

  Scenario: Editor changes an existing grade from Near Mint to Good
    Given I am logged in as an editor
    And the record "Kind of Blue" has condition "near_mint"
    When I open the detail sheet for "Kind of Blue"
    And I tap the "G" condition button
    Then the condition badge on the item card shows "G"

  # ── Viewer restriction ────────────────────────────────────────────────────────

  Scenario: Viewer sees the condition badge but cannot change the grade
    Given I am logged in as a viewer
    And the record "Kind of Blue" has condition "near_mint"
    When I open the detail sheet for "Kind of Blue"
    Then the condition badge shows "NM"
    But the condition grade buttons are not displayed

  # ── Condition sort grouping ───────────────────────────────────────────────────

  Scenario: Sorting by condition groups records into grade sections
    Given the collection contains:
      | Record       | Condition |
      | Album A      | mint      |
      | Album B      | near_mint |
      | Album C      | good      |
      | Album D      | poor      |
    When I change the sort order to "Condition"
    Then the collection is divided into sections with headings:
      | Heading    |
      | M Mint     |
      | NM Near Mint |
      | G Good     |
      | P Poor     |
    And the sections appear in best-to-worst order

  Scenario: Records without a grade appear in an "Ungraded" section at the bottom
    Given the collection contains:
      | Record   | Condition |
      | Album A  | mint      |
      | Album B  | (none)    |
    When I change the sort order to "Condition"
    Then a section headed "Ungraded" appears below all graded sections
    And "Album B" appears in the Ungraded section
