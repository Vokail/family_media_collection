-- Vinyl repair: relink 8 items to their correct Discogs VINYL release.
-- Generated from api.discogs.com/releases/<id>, hitting /releases explicitly so it
-- bypasses the master-first lookup bug in lib/apis/discogs.ts.
--
-- Only external_id / tracklist / sort_name / genres / styles are written.
-- title, creator, year, cover_path, condition, rating and status are untouched.
-- Take an export (/api/admin/export) before running this.

begin;

-- Joe Bonamassa - Live From The Royal Albert Hall (collision: tracklist came from master 2849974 = 'O (3) - Hypernormality'; old id 2849974 is also a CD release)
--   -> release 4020483 | Vinyl | 19 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '4020483',
  tracklist   = '[{"position": "A1", "title": "Django", "duration": "3:43"}, {"position": "A2", "title": "The Ballad Of John Henry", "duration": "6:47"}, {"position": "A3", "title": "So It''s Like That", "duration": "2:55"}, {"position": "A4", "title": "Last Kiss", "duration": "7:18"}, {"position": "A5", "title": "So Many Roads", "duration": "6:15"}, {"position": "A6", "title": "Stop!", "duration": "5:56"}, {"position": "B1", "title": "Further On Up The Road", "duration": "5:44"}, {"position": "B2", "title": "Woke Up Dreaming", "duration": "10:06"}, {"position": "B3", "title": "High Water Everywhere", "duration": "5:07"}, {"position": "B4", "title": "Sloe Gin", "duration": "8:18"}, {"position": "B5", "title": "Lonesome Road Blues", "duration": "4:37"}, {"position": "C1", "title": "Happier Times", "duration": "7:22"}, {"position": "C2", "title": "Your Funeral My Trial", "duration": "4:05"}, {"position": "C3", "title": "Blues Deluxe", "duration": "9:13"}, {"position": "C4", "title": "Story Of A Quarryman", "duration": "5:14"}, {"position": "C5", "title": "The Great Flood", "duration": "7:52"}, {"position": "D1", "title": "Just Got Paid", "duration": "10:44"}, {"position": "D2", "title": "Mountain Time", "duration": "10:43"}, {"position": "D3", "title": "Asking Around For You", "duration": "10:01"}]'::jsonb,
  sort_name   = 'Joe Bonamassa',
  genres      = 'Rock, Blues',
  styles      = 'Blues Rock'
where id = 'd3e416a1-5683-4d0e-b3c3-0d020e0a5e6c' and collection = 'vinyl';

-- INXS - The Very Best (was CD release 33236616)
--   -> release 11195915 | Vinyl | 20 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '11195915',
  tracklist   = '[{"position": "A1", "title": "Need You Tonight", "duration": "3:03"}, {"position": "A2", "title": "Mystify", "duration": "3:19"}, {"position": "A3", "title": "Suicide Blonde", "duration": "3:53"}, {"position": "A4", "title": "Taste It", "duration": "3:20"}, {"position": "A5", "title": "Original Sin", "duration": "5:18"}, {"position": "B1", "title": "Heaven Sent", "duration": "3:20"}, {"position": "B2", "title": "Disappear", "duration": "4:10"}, {"position": "B3", "title": "Never Tear Us Apart", "duration": "3:05"}, {"position": "B4", "title": "The Gift", "duration": "4:04"}, {"position": "B5", "title": "Devil Inside", "duration": "5:15"}, {"position": "C1", "title": "Beautiful Girl", "duration": "3:29"}, {"position": "C2", "title": "By My Side", "duration": "3:06"}, {"position": "C3", "title": "Kiss The Dirt (Falling Down The Mountain)", "duration": "3:55"}, {"position": "C4", "title": "Elegantly Wasted", "duration": "4:34"}, {"position": "C5", "title": "New Sensation", "duration": "3:41"}, {"position": "D1", "title": "What You Need", "duration": "3:36"}, {"position": "D2", "title": "Listen Like Thieves", "duration": "3:48"}, {"position": "D3", "title": "Just Keep Walking", "duration": "2:44"}, {"position": "D4", "title": "Bitter Tears", "duration": "3:50"}, {"position": "D5", "title": "Baby Don''t Cry", "duration": "4:47"}]'::jsonb,
  sort_name   = 'INXS',
  genres      = 'Rock, Pop',
  styles      = 'Alternative Rock, Pop Rock'
where id = 'c4773c11-d510-4558-b80a-7926018ed4cf' and collection = 'vinyl';

-- The Police - Greatest Hits (was CD release 13368283)
--   -> release 22840832 | Vinyl | 16 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '22840832',
  tracklist   = '[{"position": "A1", "title": "Roxanne", "duration": null}, {"position": "A2", "title": "Can''t Stand Losing You", "duration": null}, {"position": "A3", "title": "So Lonely", "duration": null}, {"position": "A4", "title": "Message In A Bottle", "duration": null}, {"position": "B1", "title": "Walking On The Moon", "duration": null}, {"position": "B2", "title": "The Bed''s Too Big Without You", "duration": null}, {"position": "B3", "title": "Don''t Stand So Close To Me", "duration": null}, {"position": "B4", "title": "De Do Do Do, De Da Da Da", "duration": null}, {"position": "C1", "title": "Every Little Thing She Does Is Magic", "duration": null}, {"position": "C2", "title": "Invisible Sun", "duration": null}, {"position": "C3", "title": "Spirits In The Material World", "duration": null}, {"position": "C4", "title": "Synchronicity II", "duration": null}, {"position": "D1", "title": "Every Breath You Take", "duration": null}, {"position": "D2", "title": "King Of Pain", "duration": null}, {"position": "D3", "title": "Wrapped Around Your Finger", "duration": null}, {"position": "D4", "title": "Tea In The Sahara", "duration": null}]'::jsonb,
  sort_name   = 'Police, The',
  genres      = 'Rock',
  styles      = 'Alternative Rock, Pop Rock'
where id = 'f75b3676-4286-41d6-9cad-836161090fab' and collection = 'vinyl';

-- Di-Rect - Live In De Kuip (was CD release 35537587)
--   -> release 35163466 | Vinyl | 19 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '35163466',
  tracklist   = '[{"position": "A1", "title": "90s Kid Pt. II", "duration": null}, {"position": "A2", "title": "Times Are Changing", "duration": null}, {"position": "A3", "title": "OMG It''s Happening", "duration": null}, {"position": "A4", "title": "Wastelands", "duration": null}, {"position": "B1", "title": "My Blood", "duration": null}, {"position": "B2", "title": "Through The Looking Glass", "duration": null}, {"position": "B3", "title": "Snakebite", "duration": null}, {"position": "C1", "title": "You Know Who I Am", "duration": null}, {"position": "C2", "title": "Wild Hearts", "duration": null}, {"position": "C3", "title": "Walk With Me", "duration": null}, {"position": "D1", "title": "Soldier On", "duration": null}, {"position": "D2", "title": "Born Again", "duration": null}, {"position": "D3", "title": "Devil Don''t Care", "duration": null}, {"position": "D4", "title": "Hibernation", "duration": null}, {"position": "E1", "title": "Sphinx", "duration": null}, {"position": "E2", "title": "How My Heart Was Won", "duration": null}, {"position": "E3", "title": "All In Vain", "duration": null}, {"position": "F1", "title": "90s Kid", "duration": null}, {"position": "F2", "title": "Young Ones", "duration": null}]'::jsonb,
  sort_name   = 'Di-Rect',
  genres      = 'Rock, Funk / Soul, Pop',
  styles      = 'Indie Rock'
where id = '8d5431b7-e78e-43d1-848f-04fd6a08e147' and collection = 'vinyl';

-- Paul Simon - Graceland (was CD release 9834960)
--   -> release 1031388 | Vinyl | 11 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '1031388',
  tracklist   = '[{"position": "A1", "title": "The Boy In The Bubble", "duration": "3:59"}, {"position": "A2", "title": "Graceland", "duration": "4:48"}, {"position": "A3", "title": "I Know What I Know", "duration": "3:13"}, {"position": "A4", "title": "Gumboots", "duration": "2:42"}, {"position": "A5", "title": "Diamonds On The Soles Of Her Shoes", "duration": "5:34"}, {"position": "B1", "title": "You Can Call Me Al", "duration": "4:39"}, {"position": "B2", "title": "Under African Skies", "duration": "3:34"}, {"position": "B3", "title": "Homeless", "duration": "3:45"}, {"position": "B4", "title": "Crazy Love, Vol. II", "duration": "4:17"}, {"position": "B5", "title": "That Was Your Mother", "duration": "2:51"}, {"position": "B6", "title": "All Around The World Or The Myth Of Fingerprints", "duration": "3:15"}]'::jsonb,
  sort_name   = 'Paul Simon',
  genres      = 'Jazz, Rock, Funk / Soul, Pop, Folk, World, & Country',
  styles      = 'Folk Rock, Pop Rock, African, Afrobeat, Zydeco, Funk, Rhythm & Blues'
where id = '73b6c432-31a5-4e78-8879-10aee025b6db' and collection = 'vinyl';

-- Eric Clapton - Clapton Chronicles (was CD release 10396732)
--   -> release 3802475 | Vinyl | 15 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '3802475',
  tracklist   = '[{"position": "A1", "title": "Blue Eyes Blue", "duration": "4:42"}, {"position": "A2", "title": "Change The World", "duration": "3:55"}, {"position": "A3", "title": "My Father''s Eyes", "duration": "5:23"}, {"position": "A4", "title": "Tears In Heaven", "duration": "4:33"}, {"position": "B1", "title": "Layla (Unplugged Version)", "duration": "4:37"}, {"position": "B2", "title": "Pretending", "duration": "4:43"}, {"position": "B3", "title": "Bad Love", "duration": "5:14"}, {"position": "B4", "title": "Before You Accuse Me (Take A Look At Yourself)", "duration": "3:57"}, {"position": "C1", "title": "It''s In The Way That You Use It", "duration": "4:11"}, {"position": "C2", "title": "Forever Man", "duration": "3:11"}, {"position": "C3", "title": "Running On Faith (Unplugged Version)", "duration": "6:26"}, {"position": "C4", "title": "She''s Waiting", "duration": "4:58"}, {"position": "D1", "title": "River Of Tears", "duration": "7:21"}, {"position": "D2", "title": "(I) Get Lost", "duration": "4:21"}, {"position": "D3", "title": "Wonderful Tonight (Live Edit)", "duration": "5:24"}]'::jsonb,
  sort_name   = 'Eric Clapton',
  genres      = 'Rock',
  styles      = 'Acoustic, Soft Rock'
where id = '27cff896-b7b3-4cbf-a1be-d7034af1dc4b' and collection = 'vinyl';

-- Eric Clapton - Unplugged (was DVD release 16035552)
--   -> release 3958518 | Vinyl | 14 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '3958518',
  tracklist   = '[{"position": "A1", "title": "Signe", "duration": "3:13"}, {"position": "A2", "title": "Before You Accuse Me", "duration": "3:44"}, {"position": "A3", "title": "Hey Hey", "duration": "3:16"}, {"position": "A4", "title": "Tears In Heaven", "duration": "4:36"}, {"position": "B1", "title": "Lonely Stranger", "duration": "5:27"}, {"position": "B2", "title": "Nobody Knows You When You''re Down And Out", "duration": "3:19"}, {"position": "B3", "title": "Layla", "duration": "4:46"}, {"position": "B4", "title": "Running On Faith", "duration": "6:30"}, {"position": "C1", "title": "Walkin'' Blues", "duration": "3:37"}, {"position": "C2", "title": "Alberta", "duration": "3:42"}, {"position": "C3", "title": "San Francisco Bay Blues", "duration": "3:23"}, {"position": "D1", "title": "Malted Milk", "duration": "3:36"}, {"position": "D2", "title": "Old Love", "duration": "7:52"}, {"position": "D3", "title": "Rollin'' And Tumblin''", "duration": "4:12"}]'::jsonb,
  sort_name   = 'Eric Clapton',
  genres      = 'Rock',
  styles      = 'Blues Rock, Acoustic'
where id = '8c6ed7c0-4e9a-44a8-9940-2ced979c1cfd' and collection = 'vinyl';

-- Sade - The Best Of Sade (was deleted release 311259)
--   -> release 8131475 | Vinyl | 16 tracks | positions ['A1', 'A2', 'A3', 'A4']
update items set
  external_id = '8131475',
  tracklist   = '[{"position": "A1", "title": "Your Love Is King", "duration": "3:41"}, {"position": "A2", "title": "Hang On To Your Love", "duration": "4:29"}, {"position": "A3", "title": "Smooth Operator", "duration": "4:16"}, {"position": "A4", "title": "Jezebel", "duration": "5:23"}, {"position": "B5", "title": "The Sweetest Taboo", "duration": "4:25"}, {"position": "B6", "title": "Is It A Crime", "duration": "6:16"}, {"position": "B7", "title": "Never As Good As The First Time", "duration": "3:58"}, {"position": "B8", "title": "Love Is Stronger Than Pride", "duration": "4:17"}, {"position": "C9", "title": "Paradise", "duration": "3:36"}, {"position": "C10", "title": "Nothing Can Come Between Us", "duration": "3:52"}, {"position": "C11", "title": "No Ordinary Love", "duration": "7:19"}, {"position": "C12", "title": "Like A Tattoo", "duration": "3:36"}, {"position": "D13", "title": "Kiss Of Life", "duration": "4:10"}, {"position": "D14", "title": "Please Send Me Someone To Love", "duration": "3:40"}, {"position": "D15", "title": "Cherish The Day", "duration": "6:17"}, {"position": "D16", "title": "Pearls", "duration": "4:35"}]'::jsonb,
  sort_name   = 'Sade',
  genres      = 'Jazz, Funk / Soul',
  styles      = 'Smooth Jazz, Soul'
where id = 'c63474b9-6d98-4b9b-bd52-0d7e9a2526a0' and collection = 'vinyl';

-- Expect: UPDATE 1, eight times. Then:
commit;
-- (or ROLLBACK; if any row count is 0)
