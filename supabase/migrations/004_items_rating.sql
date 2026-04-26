alter table items add column if not exists rating integer check (rating >= 1 and rating <= 5);
