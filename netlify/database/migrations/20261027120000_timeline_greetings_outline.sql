-- Version 3: the city timeline, the greetings in the top bar, and each city's outline for the map.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.

-- ---------------------------------------------------------------- city outline
-- The city's boundary as [[longitude, latitude], ...], drawn by the thread at the end of the timeline
-- (and later used to place landmarks on the map). outline_source says where the shape came from.
ALTER TABLE cities ADD COLUMN outline JSONB NOT NULL DEFAULT '[]';
ALTER TABLE cities ADD COLUMN outline_source TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------- timeline
-- Major events in a city's history, shown along the thread below the letter. Same life cycle as facts:
-- only status = 'verified' reaches the website. images = [{"src": "https://...", "caption": "..."}].
CREATE TABLE timeline_events (
  id          SERIAL PRIMARY KEY,
  city_id     TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  year_label  TEXT NOT NULL,                       -- shown as written: '1559', '1620s', 'c. 1360'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,                       -- a short paragraph
  images      JSONB NOT NULL DEFAULT '[]',
  source_url  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'needs_check' CHECK (status IN ('needs_check', 'verified')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);
CREATE INDEX timeline_events_city ON timeline_events (city_id);

-- ---------------------------------------------------------------- greetings
-- "Namaste", "Vanakkam"... scrolling in the yellow bar at the top of the website. Checked like facts.
CREATE TABLE greetings (
  id          SERIAL PRIMARY KEY,
  word        TEXT NOT NULL,                       -- in English letters: 'Vanakkam'
  native      TEXT NOT NULL DEFAULT '',            -- in its own script: 'வணக்கம்'
  language    TEXT NOT NULL,                       -- 'Tamil'
  source_url  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'needs_check' CHECK (status IN ('needs_check', 'verified')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------- starting content
-- Everything below arrives as 'needs_check' with no author, so any editor can check and verify it.

UPDATE cities SET outline = '[[73.76569,24.64044],[73.76903,24.63205],[73.76284,24.61408],[73.79577,24.62013],[73.79546,24.6124],[73.79202,24.60992],[73.78409,24.61433],[73.77872,24.60753],[73.77462,24.59744],[73.76241,24.60065],[73.75251,24.59738],[73.73521,24.5788],[73.73188,24.56618],[73.73613,24.54565],[73.72758,24.53956],[73.73411,24.53492],[73.73205,24.5251],[73.73966,24.51126],[73.74156,24.483],[73.73655,24.47511],[73.72381,24.48117],[73.71847,24.48859],[73.72222,24.51483],[73.71926,24.52712],[73.70116,24.5379],[73.7067,24.54515],[73.71799,24.54802],[73.7128,24.55222],[73.70407,24.55049],[73.70531,24.56339],[73.69549,24.56494],[73.68691,24.55976],[73.67803,24.56595],[73.68027,24.57375],[73.69433,24.57705],[73.6817,24.57886],[73.67479,24.60016],[73.66314,24.60645],[73.66767,24.61473],[73.6566,24.62543],[73.67138,24.61761],[73.68742,24.63282],[73.697,24.62421],[73.71014,24.62663],[73.70578,24.6363],[73.69106,24.64551],[73.69732,24.66665],[73.71073,24.67485],[73.70819,24.66501],[73.71431,24.66248],[73.71897,24.66604],[73.72003,24.64344],[73.72799,24.63195],[73.75027,24.6296],[73.76355,24.6411],[73.76569,24.64044]]'::jsonb,
  outline_source = 'Udaipur assembly constituency (the city seat, close to the city limits), DataMeet India, CC BY 2.5 IN: https://github.com/datameet/maps/tree/master/assembly-constituencies'
  WHERE id = 'udaipur';
UPDATE cities SET outline = '[[88.24214,22.55476],[88.24337,22.5574],[88.24959,22.55895],[88.29354,22.55067],[88.30645,22.54647],[88.3197,22.5484],[88.32633,22.55204],[88.32989,22.54804],[88.33001,22.54415],[88.34342,22.55297],[88.34663,22.56415],[88.33759,22.56362],[88.34494,22.57409],[88.35193,22.5945],[88.36776,22.60908],[88.3683,22.61935],[88.36436,22.63152],[88.37164,22.63253],[88.39251,22.6287],[88.39378,22.60804],[88.39169,22.59588],[88.39686,22.58972],[88.40419,22.57081],[88.41284,22.55532],[88.43385,22.5371],[88.44134,22.52766],[88.45895,22.52304],[88.45407,22.50888],[88.44824,22.50724],[88.44422,22.51125],[88.43979,22.50855],[88.43441,22.51635],[88.42709,22.51837],[88.42328,22.51709],[88.42442,22.5206],[88.42219,22.5224],[88.41978,22.515],[88.41501,22.5122],[88.41491,22.50493],[88.41036,22.50248],[88.41012,22.49843],[88.41447,22.49524],[88.41437,22.49281],[88.41148,22.49238],[88.41102,22.49012],[88.4175,22.49009],[88.41785,22.48514],[88.41426,22.47723],[88.40725,22.47767],[88.40603,22.47209],[88.39979,22.47245],[88.39442,22.46651],[88.37961,22.46413],[88.37839,22.46261],[88.38231,22.45871],[88.38004,22.45521],[88.37263,22.4536],[88.37213,22.45032],[88.36814,22.4521],[88.3699,22.45378],[88.36889,22.45624],[88.36412,22.45231],[88.36033,22.45478],[88.36186,22.45723],[88.35998,22.4597],[88.36389,22.46337],[88.35809,22.46184],[88.35169,22.45514],[88.34369,22.45515],[88.3415,22.45651],[88.34209,22.45891],[88.34445,22.45938],[88.34205,22.46248],[88.33405,22.45976],[88.33647,22.4666],[88.32708,22.46646],[88.32133,22.47156],[88.32258,22.46218],[88.32543,22.45922],[88.31224,22.45879],[88.30475,22.45637],[88.30146,22.45811],[88.29488,22.45366],[88.29241,22.45492],[88.28948,22.45336],[88.28743,22.45492],[88.28897,22.46181],[88.28781,22.4687],[88.27876,22.47181],[88.27584,22.48203],[88.27307,22.48325],[88.27379,22.48552],[88.26826,22.48939],[88.28603,22.4856],[88.28863,22.49145],[88.29077,22.49153],[88.29905,22.50375],[88.29941,22.50605],[88.2969,22.50689],[88.29841,22.51706],[88.29168,22.51617],[88.28998,22.52274],[88.29115,22.53646],[88.28203,22.53779],[88.27503,22.54168],[88.2712,22.53713],[88.26912,22.53741],[88.26487,22.53369],[88.26118,22.53552],[88.26104,22.53291],[88.25974,22.53312],[88.25537,22.53696],[88.25811,22.54132],[88.25331,22.54308],[88.25252,22.54071],[88.24479,22.54538],[88.24214,22.55476]]'::jsonb,
  outline_source = 'Kolkata Municipal Corporation wards joined into one shape, DataMeet India, CC BY-SA 2.5 IN: https://github.com/datameet/Municipal_Spatial_Data/tree/master/Kolkata'
  WHERE id = 'kolkata';

INSERT INTO timeline_events (city_id, year_label, title, body, source_url, sort_order) VALUES
  ('udaipur', '1559', 'Udaipur is founded', 'Maharana Udai Singh II founds a new capital for the Mewar kingdom in a bowl of the Aravalli hills, beside Lake Pichola.', 'https://en.wikipedia.org/wiki/Udaipur', 0),
  ('udaipur', '1576', 'The Battle of Haldighati', 'In the hills north of the city, Maharana Pratap fights the Mughal army led by Man Singh. Mewar remembers him as its greatest hero.', 'https://en.wikipedia.org/wiki/Battle_of_Haldighati', 1),
  ('udaipur', '1620s', 'A prince hides on Jag Mandir', 'The island palace of Jag Mandir shelters Prince Khurram, who later becomes the Mughal emperor Shah Jahan and builds the Taj Mahal.', 'https://en.wikipedia.org/wiki/Jag_Mandir_Palace', 2),
  ('udaipur', '1678', 'Fateh Sagar is first dammed', 'Maharana Jai Singh builds the first dam for the lake. Two centuries later Maharana Fateh Singh rebuilds it and gives it his name.', 'https://en.wikipedia.org/wiki/Fateh_Sagar_Lake', 3),
  ('udaipur', '1746', 'The Lake Palace is finished', 'Maharana Jagat Singh II completes Jag Niwas, a summer palace on an island in Lake Pichola. Today it seems to float on the water.', 'https://en.wikipedia.org/wiki/Lake_Palace', 4),
  ('udaipur', '1884', 'The Monsoon Palace', 'Maharana Sajjan Singh starts Sajjangarh on a hilltop west of the city, first planned as an observatory for watching monsoon clouds.', 'https://en.wikipedia.org/wiki/Monsoon_Palace', 5),
  ('udaipur', '1983', 'James Bond comes to town', 'The film Octopussy is shot at the Lake Palace and the Monsoon Palace, and the world sees Udaipur on the big screen.', 'https://www.jamesbondlifestyle.com/node/919', 6);
INSERT INTO timeline_events (city_id, year_label, title, body, source_url, sort_order) VALUES
  ('kolkata', '1690', 'A trading post on the Hooghly', 'The East India Company sets up a trading post among three villages, Sutanuti, Gobindapur and Kalikata. The city grows from here.', 'https://en.wikipedia.org/wiki/Kalikata', 0),
  ('kolkata', '1814', 'The Indian Museum opens', 'India''s oldest museum is founded in the city. Today it holds fossils, an Egyptian mummy and ancient sculptures.', 'https://en.wikipedia.org/wiki/Indian_Museum', 1),
  ('kolkata', '1855', 'Dakshineswar Kali Temple', 'Rani Rashmoni opens a riverside temple to the goddess Kali. The saint Ramakrishna serves as its priest and teaches here.', 'https://en.wikipedia.org/wiki/Dakshineswar_Kali_Temple', 2),
  ('kolkata', '1873', 'The first trams', 'Horse-drawn trams start running on the city''s streets. They become electric in 1902.', 'https://en.wikipedia.org/wiki/Trams_in_Kolkata', 3),
  ('kolkata', '1911', 'No longer the capital', 'The capital of British India moves from Calcutta to Delhi.', 'https://www.newworldencyclopedia.org/entry/kolkata', 4),
  ('kolkata', '1913', 'A Nobel Prize for Tagore', 'Rabindranath Tagore, born in the city, wins the Nobel Prize in Literature, the first for anyone from outside Europe.', 'https://www.britannica.com/biography/Rabindranath-Tagore', 5),
  ('kolkata', '1943', 'Howrah Bridge opens', 'A giant cantilever bridge, held together with rivets instead of nuts and bolts, opens over the Hooghly.', 'https://en.wikipedia.org/wiki/Howrah_Bridge', 6),
  ('kolkata', '1984', 'India''s first metro', 'The first metro railway in India opens in the city. Forty years later it also gets India''s first underwater metro tunnel.', 'https://en.wikipedia.org/wiki/Kolkata_Metro', 7),
  ('kolkata', '2001', 'Calcutta becomes Kolkata', 'The city officially changes its name to Kolkata, the way it is said in Bengali.', 'https://www.newworldencyclopedia.org/entry/kolkata', 8),
  ('kolkata', '2021', 'Durga Puja joins UNESCO''s list', 'UNESCO adds Durga Puja in Kolkata to its list of the Intangible Cultural Heritage of Humanity.', 'https://ich.unesco.org/en/RL/durga-puja-in-kolkata-00703', 9);

INSERT INTO greetings (word, native, language, source_url, sort_order) VALUES
  ('Namaste', 'नमस्ते', 'Hindi', 'https://en.wikipedia.org/wiki/Namaste', 0),
  ('Vanakkam', 'வணக்கம்', 'Tamil', 'https://en.wiktionary.org/wiki/வணக்கம்', 1),
  ('Nomoshkar', 'নমস্কার', 'Bengali', 'https://en.wiktionary.org/wiki/নমস্কার', 2),
  ('Khamma Ghani', 'खम्मा घणी', 'Rajasthani', 'https://avtans.com/2026/03/17/khamma-ghani-origins-and-significance-explored/', 3),
  ('Namaskara', 'ನಮಸ್ಕಾರ', 'Kannada', 'https://en.wiktionary.org/wiki/ನಮಸ್ಕಾರ', 4),
  ('Sat Sri Akal', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'Punjabi', 'https://en.wikipedia.org/wiki/Sat_Sri_Akal', 5),
  ('Namaskaram', 'నమస్కారం', 'Telugu', 'https://en.wiktionary.org/wiki/నమస్కారం', 6),
  ('Kem chho', 'કેમ છો', 'Gujarati', '', 7),
  ('Namaskar', 'नमस्कार', 'Marathi', 'https://en.wiktionary.org/wiki/नमस्कार', 8),
  ('Namaskaram', 'നമസ്കാരം', 'Malayalam', 'https://en.wiktionary.org/wiki/നമസ്കാരം', 9),
  ('Adaab', 'آداب', 'Urdu', 'https://en.wikipedia.org/wiki/Adab_(gesture)', 10),
  ('Namaskar', 'ନମସ୍କାର', 'Odia', '', 11),
  ('Nomoskar', 'নমস্কাৰ', 'Assamese', '', 12),
  ('Julley', 'ཇུ་ལེ', 'Ladakhi', '', 13),
  ('Tashi Delek', 'བཀྲ་ཤིས་བདེ་ལེགས', 'Sikkimese', '', 14);
