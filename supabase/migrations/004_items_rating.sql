-- Adds rating column for installations that ran 003 before rating was introduced.
-- Safe to run on any database; the column already exists on fresh installs using updated 001/003.

alter table items
  add column if not exists rating integer check (rating >= 1 and rating <= 5);
