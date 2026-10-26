// Everything Virasat teaches. Dates and claims here are the widely documented ones;
// where history is disputed the text says so.
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
    greetingNote: 'the traditional Mewari greeting',
    from: 'Gaju, at the ghats of Lake Pichola',
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
          { title: 'City Palace', text: 'Begun in 1559 and added to by Maharanas for roughly 400 years, this complex of courtyards, towers and mirror-work halls rises above the east bank of Lake Pichola. It is one of the largest palace complexes in Rajasthan.' },
          { title: 'Lake Pichola', text: 'An artificial lake first created in 1362, long before the city existed, and later enlarged by Udai Singh II. Boats from the palace ghats still carry visitors out to its island palaces.' },
          { title: 'Lake Palace (Jag Niwas)', text: 'Built between 1743 and 1746 by Maharana Jagat Singh II as a summer palace on an island. Today it is a hotel that seems to float on the water.' },
          { title: 'Jag Mandir', text: 'A second island palace. In the 1620s it sheltered Prince Khurram, who later became the Mughal emperor Shah Jahan, builder of the Taj Mahal.' },
          { title: 'Fateh Sagar Lake', text: 'Named after Maharana Fateh Singh, who rebuilt its dam in the late 1800s. Nehru Garden sits on an island in the middle.' },
          { title: 'Sajjangarh (Monsoon Palace)', text: 'Built in 1884 by Maharana Sajjan Singh on a hilltop west of the city, originally to watch the monsoon clouds roll in.' },
          { title: 'Saheliyon-ki-Bari', text: 'The "Garden of the Maidens", laid out in the 18th century with lotus pools, marble elephants and fountains for the royal women.' },
        ],
      },
      {
        id: 'festivals', label: 'Festivals & Arts', icon: '🪔',
        items: [
          { title: 'Mewar Festival', text: 'Held in spring during Gangaur. Women dress in their brightest clothes and carry idols of the goddess Gauri in procession to Gangaur Ghat, followed by music, dance and fireworks over Lake Pichola.' },
          { title: 'Shilpgram Utsav', text: 'A ten-day crafts fair every December at Shilpgram, a rural arts village outside the city where artisans from western India show their work.' },
          { title: 'Mewar miniature painting', text: 'A tradition of small, richly detailed paintings of court life, hunts and stories of Krishna, made with fine brushes and mineral colours.' },
          { title: 'Pichwai', text: 'Large cloth paintings made for the Shrinathji temple in nearby Nathdwara, showing Krishna with cows, lotuses and seasonal festivals.' },
          { title: 'Kathputli puppets', text: 'Rajasthan\'s string puppets tell old stories of kings and heroes. Udaipur\'s Bharatiya Lok Kala Mandal has a whole museum of them.' },
          { title: 'Dharohar dance show', text: 'Every evening at Bagore ki Haveli, dancers perform Rajasthani folk dances, including Bhavai, where a dancer balances a tall stack of pots on her head.' },
        ],
      },
      {
        id: 'food', label: 'Food', icon: '🍛',
        items: [
          { title: 'Dal Baati Churma', text: 'Hard wheat balls (baati) baked over fire, cracked open and soaked in ghee, eaten with spicy dal and sweet crumbled churma.' },
          { title: 'Gatte ki Sabzi', text: 'Steamed gram-flour dumplings in a tangy yoghurt curry, a dish born in a desert land where fresh vegetables were scarce.' },
          { title: 'Ker Sangri', text: 'A desert-bean and wild-berry dish cooked with spices. Both ingredients grow in the dry lands of Rajasthan.' },
          { title: 'Mirchi Vada', text: 'A big green chilli stuffed with spiced potato, dipped in batter and fried. A favourite tea-time snack.' },
          { title: 'Laal Maas', text: 'A fiery red mutton curry made with Mathania chillies, linked to the royal kitchens of Mewar.' },
        ],
      },
      {
        id: 'facts', label: 'Fun Facts', icon: '✨',
        items: [
          { title: 'A Bond film was shot here', text: 'The 1983 James Bond film Octopussy used the Lake Palace and the Monsoon Palace as filming locations.' },
          { title: 'Maharana Pratap', text: 'Mewar\'s most famous ruler fought the Mughal army at the Battle of Haldighati in 1576, in the hills north of Udaipur.' },
          { title: 'The sun on the walls', text: 'The Mewar rulers traced their line to the sun god, so a golden sun face appears on the walls of the City Palace.' },
          { title: 'Lakes that talk to each other', text: 'Lake Pichola and Fateh Sagar are linked by a channel, so water can flow between them.' },
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
          { title: 'Victoria Memorial', text: 'A huge white marble hall, opened in 1921 in memory of Queen Victoria. It is now a museum, surrounded by gardens and ponds.' },
          { title: 'Howrah Bridge (Rabindra Setu)', text: 'A giant cantilever bridge over the Hooghly, opened in 1943. It is held together with rivets rather than nuts and bolts, and carries a huge flow of people and vehicles every day.' },
          { title: 'Indian Museum', text: 'Founded in 1814, it is the oldest museum in India, with fossils, an Egyptian mummy and ancient sculptures.' },
          { title: 'Dakshineswar Kali Temple', text: 'A riverside temple built in 1855 by Rani Rashmoni. The saint Ramakrishna lived and taught here.' },
          { title: 'Kumartuli', text: 'The potters\' quarter on the river, where families of artists shape the clay idols of Durga every year by hand.' },
          { title: 'College Street (Boi Para)', text: 'The "book neighbourhood": a long stretch of second-hand bookstalls beside famous colleges and the Indian Coffee House.' },
        ],
      },
      {
        id: 'festivals', label: 'Festivals & Arts', icon: '🪔',
        items: [
          { title: 'Durga Puja', text: 'Kolkata\'s biggest festival. Artists build thousands of themed pandals (temporary shrines) for the goddess Durga. In 2021 UNESCO added Durga Puja in Kolkata to its list of the Intangible Cultural Heritage of Humanity.' },
          { title: 'Dhunuchi naach and sindoor khela', text: 'During Puja, dancers swing clay pots of smoking incense, and on the last day married women smear each other with red sindoor.' },
          { title: 'International Kolkata Book Fair', text: 'Held every winter since 1976, it is one of the biggest book fairs in the world by number of visitors.' },
          { title: 'Rabindra Sangeet', text: 'The songs written by Rabindranath Tagore, more than two thousand of them, still sung across Bengal.' },
          { title: 'Kalighat painting', text: 'Bold, quick-brush paintings that began in the 19th century near the Kalighat temple, showing gods and everyday city life.' },
        ],
      },
      {
        id: 'food', label: 'Food', icon: '🍛',
        items: [
          { title: 'Rosogolla', text: 'Soft cheese balls in sugar syrup. In 2017 West Bengal received a GI tag for "Banglar Rosogolla".' },
          { title: 'Mishti Doi', text: 'Sweet yoghurt set in clay pots, which soak up extra water and make it thick.' },
          { title: 'Phuchka', text: 'Kolkata\'s version of pani puri: crisp shells filled with spiced potato and tangy tamarind water.' },
          { title: 'Kathi Roll', text: 'Kebabs wrapped in a flaky paratha, a Kolkata invention now eaten all over India.' },
          { title: 'Shorshe Ilish', text: 'Hilsa fish cooked in a sharp mustard sauce, a Bengali favourite during the monsoon.' },
          { title: 'Kolkata Biryani', text: 'Lighter than other biryanis and famous for its potato, linked to the cooks of Nawab Wajid Ali Shah, who settled in the city in 1856.' },
        ],
      },
      {
        id: 'facts', label: 'Fun Facts', icon: '✨',
        items: [
          { title: 'India\'s first metro', text: 'India\'s first metro railway opened in Kolkata in 1984. In 2024 the city also opened India\'s first underwater metro tunnel, under the Hooghly.' },
          { title: 'Trams since 1873', text: 'Kolkata\'s trams began in 1873, pulled by horses, and became electric in 1902. It is the only Indian city that kept its trams into the 21st century.' },
          { title: 'Asia\'s first Nobel', text: 'Rabindranath Tagore, born in Kolkata, won the Nobel Prize in Literature in 1913, the first for any Asian. He also wrote India\'s national anthem.' },
          { title: 'An Oscar for Ray', text: 'Kolkata filmmaker Satyajit Ray received an honorary Academy Award in 1992 for his lifetime of work.' },
          { title: 'Yellow taxis', text: 'The yellow Ambassador taxi became a symbol of the city.' },
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
