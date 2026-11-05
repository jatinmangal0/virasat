-- Khasi greeting: "Khublei" mainly means "thank you" / "God bless you", so it read oddly in a bar of hellos.
-- Meghalaya Tourism's language guide gives "Kumno" as the Khasi hello (it also gives Khublei = thank you).
-- Khasi is written in the Latin script, so there is no separate native spelling.
-- Only touches the row while it still says Khublei, so an editor's later change is left alone.
UPDATE greetings
SET word = 'Kumno',
    source_url = 'https://meghalayatourism.in/plan/travel-tools/local-language-guide-&-etiquette/',
    updated_at = now()
WHERE language = 'Khasi' AND word = 'Khublei';
