// Everything Virasat teaches. Each card has a `src` link and each city a `sources` list
// (checked Oct 2026). Quiz answers repeat facts from the cards. Where history is disputed the text says so.
export const CITIES = {
  udaipur: {
    id: 'udaipur',
    name: 'Udaipur',
    native: 'उदयपुर',
    state: 'Rajasthan',
    nickname: 'The City of Lakes',
    accent: '#2b45a6',
    stamp: 'assets/stamp-udaipur.png',
    poster: 'assets/poster-udaipur.jpg',
    greeting: 'Khamma Ghani!',
    greetingNote: 'a traditional Rajasthani greeting',
    from: 'Gaju, at the ghats of Lake Pichola',
    sources: [
      ['Udaipur (founding, Mewar)', 'https://en.wikipedia.org/wiki/Udaipur'],
      ['Sisodia dynasty', 'https://en.wikipedia.org/wiki/Sisodia_dynasty'],
      ['Mewari language', 'https://en.wikipedia.org/wiki/Mewari_language'],
      ['Khamma Ghani greeting', 'https://avtans.com/2026/03/17/khamma-ghani-origins-and-significance-explored/'],
      ['Venice of the East', 'https://www.wildfrontierstravel.com/en_AU/blog/in-udaipur-venice-of-the-east'],
    ],
    letter: [
      'Udaipur sits in a bowl of the Aravalli hills in southern Rajasthan. Maharana Udai Singh II founded it in 1559 as the new capital of the Mewar kingdom, ruled by the Sisodia Rajputs.',
      'The city grew around a chain of man-made lakes, and its rulers built marble palaces right at the water\'s edge. That is why travellers call it the City of Lakes, and sometimes the Venice of the East.',
    ],
    quickFacts: [
      ['Founded', '1559'],
      ['Founder', 'Maharana Udai Singh II'],
      ['Kingdom', 'Mewar'],
      ['Language', 'Mewari, Hindi'],
    ],
    sections: [
      {
        id: 'landmarks', label: 'Landmarks', icon: '🏰',
        items: [
          { title: 'City Palace', text: 'Begun by Udai Singh II in the mid-1500s and added to by Maharanas for roughly 400 years, this complex of courtyards, towers and mirror-work halls rises above the east bank of Lake Pichola. It is one of the largest palace complexes in Rajasthan.', src: 'https://en.wikipedia.org/wiki/City_Palace,_Udaipur' },
          { title: 'Lake Pichola', text: 'An artificial lake said to date from the late 1300s, long before the city existed, and later enlarged by Udai Singh II. Boats from the palace ghats still carry visitors out to its island palaces.', src: 'https://en.wikipedia.org/wiki/Lake_Pichola' },
          { title: 'Lake Palace (Jag Niwas)', text: 'Built between 1743 and 1746 by Maharana Jagat Singh II as a summer palace on an island. Today it is a hotel that seems to float on the water.', src: 'https://en.wikipedia.org/wiki/Lake_Palace' },
          { title: 'Jag Mandir', text: 'A second island palace. In the 1620s it sheltered Prince Khurram, who later became the Mughal emperor Shah Jahan, builder of the Taj Mahal.', src: 'https://en.wikipedia.org/wiki/Jag_Mandir_Palace' },
          { title: 'Fateh Sagar Lake', text: 'First dammed in 1678 by Maharana Jai Singh, then rebuilt and renamed by Maharana Fateh Singh in the late 1800s. Nehru Park sits on the largest of its three islands.', src: 'https://en.wikipedia.org/wiki/Fateh_Sagar_Lake' },
          { title: 'Sajjangarh (Monsoon Palace)', text: 'Built in 1884 by Maharana Sajjan Singh on a hilltop west of the city. It was first planned as an observatory for watching monsoon clouds, but he died before it was finished.', src: 'https://en.wikipedia.org/wiki/Monsoon_Palace' },
          { title: 'Saheliyon-ki-Bari', text: 'The "Garden of the Maidens", laid out in the early 18th century by Maharana Sangram Singh II, with a lotus pool, marble elephants and fountains for the royal women.', src: 'https://en.wikipedia.org/wiki/Saheliyon-ki-Bari' },
        ],
      },
      {
        id: 'festivals', label: 'Festivals & Arts', icon: '🪔',
        items: [
          { title: 'Mewar Festival', text: 'Held in spring during Gangaur. Women dress in their brightest clothes and carry idols of the goddess Gauri in procession to Gangaur Ghat, followed by music, dance and fireworks over Lake Pichola.', src: 'https://utsav.gov.in/view-event/mewar-festival' },
          { title: 'Shilpgram Utsav', text: 'A ten-day crafts fair every December at Shilpgram, a rural arts village outside the city where artisans from western India show their work.', src: 'https://en.wikipedia.org/wiki/Shilpgram,_Udaipur' },
          { title: 'Mewar miniature painting', text: 'A tradition of small, richly detailed paintings of court life, hunts and stories of Krishna, made with fine brushes and mineral colours.', src: 'https://mapacademy.io/article/mewar-school-of-painting/' },
          { title: 'Pichwai', text: 'Large cloth paintings made for the Shrinathji temple in nearby Nathdwara, showing Krishna with cows, lotuses and seasonal festivals.', src: 'https://en.wikipedia.org/wiki/Nathdwara_painting' },
          { title: 'Kathputli puppets', text: 'Rajasthan\'s string puppets tell old stories of kings and heroes. Udaipur\'s Bharatiya Lok Kala Mandal has a whole museum of them.', src: 'https://en.wikipedia.org/wiki/Bharatiya_Lok_Kala_Mandal' },
          { title: 'Dharohar dance show', text: 'An evening show, long held at Bagore ki Haveli, where dancers perform Rajasthani folk dances, including Bhavai, where a dancer balances a tall stack of pots on her head.', src: 'https://www.lonelyplanet.com/points-of-interest/dharohar/449475' },
        ],
      },
      {
        id: 'food', label: 'Food', icon: '🍛',
        items: [
          { title: 'Dal Baati Churma', text: 'Hard wheat balls (baati) baked over fire, cracked open and soaked in ghee, eaten with spicy dal and sweet crumbled churma.', src: 'https://en.wikipedia.org/wiki/Rajasthani_cuisine' },
          { title: 'Gatte ki Sabzi', text: 'Gram-flour dumplings, boiled or steamed, in a tangy yoghurt curry. A good dish for a desert land where fresh vegetables were scarce.', src: 'https://en.wikipedia.org/wiki/Rajasthani_cuisine' },
          { title: 'Ker Sangri', text: 'A desert-bean and wild-berry dish cooked with spices. Both ingredients grow in the dry lands of Rajasthan.', src: 'https://en.wikipedia.org/wiki/Rajasthani_cuisine' },
          { title: 'Mirchi Vada', text: 'A big green chilli stuffed with spiced potato, dipped in gram-flour batter and fried. It comes from Jodhpur and is loved across Rajasthan.', src: 'https://en.wikipedia.org/wiki/Mirchi_bada' },
          { title: 'Laal Maas', text: 'A fiery red mutton curry made with Mathania chillies, linked to the hunting camps of Rajput royalty.', src: 'https://en.wikipedia.org/wiki/Laal_maas' },
        ],
      },
      {
        id: 'facts', label: 'Fun Facts', icon: '✨',
        items: [
          { title: 'A Bond film was shot here', text: 'The 1983 James Bond film Octopussy used the Lake Palace and the Monsoon Palace as filming locations.', src: 'https://www.jamesbondlifestyle.com/node/919' },
          { title: 'Maharana Pratap', text: 'Mewar\'s most famous ruler fought the Mughal army led by Man Singh at the Battle of Haldighati in 1576, in the hills north of Udaipur.', src: 'https://en.wikipedia.org/wiki/Battle_of_Haldighati' },
          { title: 'The sun on the walls', text: 'The Mewar rulers traced their line to the sun god, so a huge ornamental sun shines in the Surya Chopar (Sun Square) of the City Palace.', src: 'https://www.lonelyplanet.com/articles/guide-to-city-palace-udaipur' },
          { title: 'Lakes that talk to each other', text: 'Lake Pichola and Fateh Sagar are linked through the smaller Swaroop Sagar lake and a canal, so water can flow between them.', src: 'https://en.wikipedia.org/wiki/Swaroop_Sagar_Lake' },
        ],
      },
    ],
    quiz: [
      { q: 'Who founded Udaipur in 1559?', options: ['Maharana Pratap', 'Maharana Udai Singh II', 'Maharana Sajjan Singh', 'Akbar'], answer: 1 },
      { q: 'Which lake is the Lake Palace (Jag Niwas) built in?', options: ['Fateh Sagar', 'Lake Pichola', 'Dal Lake', 'Hussain Sagar'], answer: 1 },
      { q: 'What is Sajjangarh also called?', options: ['Monsoon Palace', 'Wind Palace', 'Mirror Palace', 'Water Palace'], answer: 0 },
      { q: 'Which James Bond film was shot in Udaipur?', options: ['Skyfall', 'Goldfinger', 'Octopussy', 'Dr. No'], answer: 2 },
      { q: 'Dal Baati Churma: what is the "baati"?', options: ['A sweet syrup', 'A baked wheat ball', 'A lentil soup', 'A fried chilli'], answer: 1 },
    ],
  },

  kolkata: {
    id: 'kolkata',
    name: 'Kolkata',
    native: 'কলকাতা',
    state: 'West Bengal',
    nickname: 'The City of Joy',
    accent: '#b9503a',
    stamp: 'assets/stamp-kolkata.png',
    poster: 'assets/poster-kolkata.jpg',
    greeting: 'Nomoshkar!',
    greetingNote: 'hello, in Bengali',
    from: 'Gaju, on the banks of the Hooghly',
    sources: [
      ['Hooghly river (Britannica)', 'https://www.britannica.com/place/Hugli-River'],
      ['The three villages and 1690', 'https://en.wikipedia.org/wiki/Kalikata'],
      ['Capital until 1911, renamed 2001', 'https://www.newworldencyclopedia.org/entry/kolkata'],
      ['City of Joy nickname', 'https://en.wikipedia.org/wiki/City_of_Joy'],
    ],
    letter: [
      'Kolkata stands on the east bank of the Hooghly river, a branch of the Ganga. It grew from three villages, Sutanuti, Gobindapur and Kalikata, where the East India Company set up a trading post in 1690.',
      'It was the capital of British India until 1911 and the heart of the Bengal Renaissance, a burst of new ideas in literature, science and social reform. The city officially changed its name from Calcutta to Kolkata in 2001.',
    ],
    quickFacts: [
      ['Trading post', '1690'],
      ['Capital of British India', 'until 1911'],
      ['Renamed Kolkata', '2001'],
      ['Language', 'Bengali'],
    ],
    sections: [
      {
        id: 'landmarks', label: 'Landmarks', icon: '🏛️',
        items: [
          { title: 'Victoria Memorial', text: 'A huge white marble hall, opened in 1921 in memory of Queen Victoria. It is now a museum, surrounded by gardens and ponds.', src: 'https://en.wikipedia.org/wiki/Victoria_Memorial,_Kolkata' },
          { title: 'Howrah Bridge (Rabindra Setu)', text: 'A giant cantilever bridge over the Hooghly, opened in 1943. It is held together with rivets rather than nuts and bolts, and carries a huge flow of people and vehicles every day.', src: 'https://en.wikipedia.org/wiki/Howrah_Bridge' },
          { title: 'Indian Museum', text: 'Founded in 1814, it is the oldest museum in India, with fossils, an Egyptian mummy and ancient sculptures.', src: 'https://en.wikipedia.org/wiki/Indian_Museum' },
          { title: 'Dakshineswar Kali Temple', text: 'A riverside temple built by Rani Rashmoni and opened in 1855. The saint Ramakrishna served as its priest and taught here.', src: 'https://en.wikipedia.org/wiki/Dakshineswar_Kali_Temple' },
          { title: 'Kumartuli', text: 'The potters\' quarter on the river, where families of artists shape the clay idols of Durga every year by hand.', src: 'https://en.wikipedia.org/wiki/Kumortuli' },
          { title: 'College Street (Boi Para)', text: 'The "book neighbourhood": a long stretch of second-hand bookstalls beside famous colleges and the Indian Coffee House.', src: 'https://en.wikipedia.org/wiki/College_Street,_Kolkata' },
        ],
      },
      {
        id: 'festivals', label: 'Festivals & Arts', icon: '🪔',
        items: [
          { title: 'Durga Puja', text: 'Kolkata\'s biggest festival. Artists build thousands of themed pandals (temporary shrines) for the goddess Durga. In 2021 UNESCO added Durga Puja in Kolkata to its list of the Intangible Cultural Heritage of Humanity.', src: 'https://ich.unesco.org/en/RL/durga-puja-in-kolkata-00703' },
          { title: 'Dhunuchi naach and sindoor khela', text: 'During Puja, dancers swing clay pots of smoking incense, and on the last day married women smear each other with red sindoor.', src: 'https://en.wikipedia.org/wiki/Dhunuchi_Nritya' },
          { title: 'International Kolkata Book Fair', text: 'Held every winter since 1976, it is one of the biggest book fairs in the world by number of visitors.', src: 'https://en.wikipedia.org/wiki/Kolkata_Book_Fair' },
          { title: 'Rabindra Sangeet', text: 'The songs written by Rabindranath Tagore, more than two thousand of them, still sung across Bengal.', src: 'https://en.wikipedia.org/wiki/Rabindra_Sangeet' },
          { title: 'Kalighat painting', text: 'Bold, quick-brush paintings that began in the 19th century near the Kalighat temple, showing gods and everyday city life.', src: 'https://en.wikipedia.org/wiki/Kalighat_painting' },
        ],
      },
      {
        id: 'food', label: 'Food', icon: '🍛',
        items: [
          { title: 'Rosogolla', text: 'Soft cheese balls in sugar syrup. In 2017 West Bengal received a GI tag for "Banglar Rosogolla".', src: 'https://moneylife.in/article/tag-only-for-banglar-rasogolloa-not-for-the-sweet-in-general-gi-registry/52187.html' },
          { title: 'Mishti Doi', text: 'Sweet yoghurt set in clay pots, which soak up extra water and make it thick.', src: 'https://en.wikipedia.org/wiki/Mishti_doi' },
          { title: 'Phuchka', text: 'Kolkata\'s version of pani puri: crisp shells filled with spiced potato and tangy tamarind water.', src: 'https://en.wikipedia.org/wiki/Panipuri' },
          { title: 'Kathi Roll', text: 'Kebabs wrapped in a flaky paratha. It is usually traced to Nizam\'s restaurant in Kolkata and is now eaten all over India.', src: 'https://www.atlasobscura.com/articles/the-kati-roll-can-be-traced-back-to-one-kolkata-restaurant' },
          { title: 'Shorshe Ilish', text: 'Hilsa fish cooked in a sharp mustard sauce, a Bengali favourite during the monsoon.', src: 'https://en.wikipedia.org/wiki/Shorshe_ilish' },
          { title: 'Kolkata Biryani', text: 'Lighter than other biryanis and famous for its potato, linked to the cooks of Nawab Wajid Ali Shah, who settled in the city in 1856.', src: 'https://www.sahapedia.org/the-kolkata-biryani-culture-identity-and-politics' },
        ],
      },
      {
        id: 'facts', label: 'Fun Facts', icon: '✨',
        items: [
          { title: 'India\'s first metro', text: 'India\'s first metro railway opened in Kolkata in 1984. In 2024 the city also opened India\'s first underwater metro tunnel, under the Hooghly.', src: 'https://en.wikipedia.org/wiki/Kolkata_Metro' },
          { title: 'Trams since 1873', text: 'Kolkata\'s trams began in 1873, pulled by horses, and became electric in 1902. It is the only Indian city that kept its trams into the 21st century, though only a couple of routes still run.', src: 'https://en.wikipedia.org/wiki/Trams_in_Kolkata' },
          { title: 'A first for Asia', text: 'Rabindranath Tagore, born in Kolkata, won the Nobel Prize in Literature in 1913, the first for anyone from outside Europe. He also wrote India\'s national anthem.', src: 'https://www.britannica.com/biography/Rabindranath-Tagore' },
          { title: 'An Oscar for Ray', text: 'Kolkata filmmaker Satyajit Ray received an honorary Academy Award in 1992 for his lifetime of work.', src: 'https://en.wikipedia.org/wiki/Satyajit_Ray' },
          { title: 'Yellow taxis', text: 'The yellow Ambassador taxi became a symbol of the city. Old ones are now being retired under a 15-year age limit.', src: 'https://www.outlooktraveller.com/experiences/culture/after-trams-will-kolkatas-iconic-yellow-ambassador-taxi-ride-into-the-sunset' },
        ],
      },
    ],
    quiz: [
      { q: 'Which river does Kolkata stand on?', options: ['Yamuna', 'Hooghly', 'Godavari', 'Narmada'], answer: 1 },
      { q: 'In which year did UNESCO recognise Durga Puja in Kolkata?', options: ['2001', '2011', '2017', '2021'], answer: 3 },
      { q: 'Howrah Bridge is also called…', options: ['Vidyasagar Setu', 'Rabindra Setu', 'Ram Setu', 'Bandra Setu'], answer: 1 },
      { q: 'Kolkata was the capital of British India until…', options: ['1857', '1911', '1947', '1950'], answer: 1 },
      { q: 'Where did India\'s first metro railway open, in 1984?', options: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'], answer: 2 },
    ],
  },
};
