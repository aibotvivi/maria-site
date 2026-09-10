/* Ask Maria — landing-page interactions.
 *
 * Only the "Say it how you'd say it" demo lives here. Consent is owned by
 * analytics.js (which builds the banner Consent Mode actually listens to) and
 * the signup flow by invite.js — both deliberately, so there is one
 * implementation of each rather than two that disagree.
 */
(function () {
  "use strict";

  /* ---------- "Say it how you'd say it" ------------------------------------
     A front-end illusion over a fixed city list. It cannot parse language and
     is not trying to; what it MUST get right is the SHAPE of the ask, because
     the shape is the thing the panel is making a promise about.

     Maria stores two different things, and the demo has to tell them apart:

       routes      independent watches, each with its own price. Twenty max.
       trip_combos several legs summed into ONE running total. Four max.

     The signal is not how many cities were named — it is how many PRICES.
     "Cusco to Lima to Cancún under £300 for the lot" is one trip with one
     total. "Tokyo under £600 and Lisbon under £90" is two watches with two.

     The first version had a single shape — a chain of cities — and forced
     everything into it, silently dropping whatever did not fit: a second
     price, a second month, an entire second trip. "Tokyo under £600 and
     Lisbon under £90" rendered as "Tokyo → Lisbon, under £600", which is not
     a rough answer, it is a wrong one, and it is wrong in the direction that
     costs most — it teaches a visitor that Maria mangles what you tell her,
     on the one screen built to prove she doesn't.

     So the rules here, in priority order:

       1. Never silently drop anything. If a price or a date was typed and is
          not shown, say so.
       2. When the shape is ambiguous, say what Maria would ASK. An honest
          "she'd check which of these you meant" is worth more than a
          confident guess, and it is also what actually happens next.
       3. Only claim a reading when the input supports it.

     To make this real rather than an illusion, POST the textarea value to an
     endpoint running the same Claude parse step the bot uses, and render the
     returned fields into the [data-parsed] slots. */

  /* What she can name. This is a CONVENIENCE, not the parser's understanding
     of the world — everything below works on sentence structure, and anything
     absent is reported as unrecognised rather than dropped. But "hkg" and
     "cdmx" showed the list was too thin to be useful: people type codes and
     short names constantly, and being told she does not recognise LHR reads
     as her not knowing what an airport is.

     Keys are lowercase; resolvePlace() lowercases before looking up. */

  /* City and country-capital names, plus the short forms and old names people
     actually type. Values are what gets shown back. */
  var CITIES = {
    // UK & Ireland
    "london":"London","manchester":"Manchester","edinburgh":"Edinburgh",
    "glasgow":"Glasgow","birmingham":"Birmingham","bristol":"Bristol",
    "newcastle":"Newcastle","liverpool":"Liverpool","leeds":"Leeds",
    "belfast":"Belfast","cardiff":"Cardiff","aberdeen":"Aberdeen",
    "dublin":"Dublin","cork":"Cork","shannon":"Shannon",
    // Western Europe
    "paris":"Paris","amsterdam":"Amsterdam","brussels":"Brussels",
    "luxembourg":"Luxembourg","geneva":"Geneva","zurich":"Zurich",
    "basel":"Basel","frankfurt":"Frankfurt","munich":"Munich","berlin":"Berlin",
    "hamburg":"Hamburg","cologne":"Cologne","dusseldorf":"Düsseldorf",
    "vienna":"Vienna","salzburg":"Salzburg","innsbruck":"Innsbruck",
    // Iberia
    "madrid":"Madrid","barcelona":"Barcelona","seville":"Seville",
    "valencia":"Valencia","bilbao":"Bilbao","malaga":"Málaga","málaga":"Málaga",
    "alicante":"Alicante","murcia":"Murcia","almeria":"Almería",
    "palma":"Palma","majorca":"Palma","mallorca":"Palma","ibiza":"Ibiza",
    "menorca":"Menorca","gran canaria":"Gran Canaria","tenerife":"Tenerife",
    "lanzarote":"Lanzarote","fuerteventura":"Fuerteventura",
    "lisbon":"Lisbon","porto":"Porto","faro":"Faro","madeira":"Madeira",
    "funchal":"Madeira","azores":"the Azores",
    // Italy, Greece, Balkans
    "rome":"Rome","milan":"Milan","venice":"Venice","florence":"Florence",
    "naples":"Naples","turin":"Turin","bologna":"Bologna","pisa":"Pisa",
    "bari":"Bari","catania":"Catania","palermo":"Palermo","sardinia":"Sardinia",
    "athens":"Athens","thessaloniki":"Thessaloniki","crete":"Crete",
    "heraklion":"Crete","rhodes":"Rhodes","corfu":"Corfu","santorini":"Santorini",
    "mykonos":"Mykonos","kos":"Kos","zakynthos":"Zakynthos",
    "split":"Split","dubrovnik":"Dubrovnik","zagreb":"Zagreb","tirana":"Tirana",
    "ljubljana":"Ljubljana","sarajevo":"Sarajevo","belgrade":"Belgrade",
    "sofia":"Sofia","bucharest":"Bucharest",
    // Nordics & Baltics
    "copenhagen":"Copenhagen","stockholm":"Stockholm","gothenburg":"Gothenburg",
    "oslo":"Oslo","bergen":"Bergen","helsinki":"Helsinki","reykjavik":"Reykjavik",
    "reykjavík":"Reykjavik","tromso":"Tromsø","riga":"Riga","tallinn":"Tallinn",
    "vilnius":"Vilnius",
    // Central & Eastern Europe
    "nice":"Nice","marseille":"Marseille","lyon":"Lyon","toulouse":"Toulouse",
    "bordeaux":"Bordeaux","cannes":"Nice","strasbourg":"Strasbourg",
    "prague":"Prague","budapest":"Budapest","krakow":"Kraków","kraków":"Kraków",
    "warsaw":"Warsaw","gdansk":"Gdańsk","wroclaw":"Wrocław","bratislava":"Bratislava",
    // Türkiye, Middle East, North Africa
    "istanbul":"Istanbul","antalya":"Antalya","izmir":"Izmir",
    "dubai":"Dubai","abu dhabi":"Abu Dhabi","doha":"Doha","muscat":"Muscat",
    "amman":"Amman","beirut":"Beirut","tel aviv":"Tel Aviv","jerusalem":"Tel Aviv",
    "cairo":"Cairo","hurghada":"Hurghada","sharm el sheikh":"Sharm el-Sheikh",
    "marrakesh":"Marrakesh","marrakech":"Marrakesh","casablanca":"Casablanca",
    "agadir":"Agadir","tunis":"Tunis",
    // Sub-Saharan Africa
    "johannesburg":"Johannesburg","cape town":"Cape Town","durban":"Durban",
    "nairobi":"Nairobi","lagos":"Lagos","accra":"Accra","addis ababa":"Addis Ababa",
    "zanzibar":"Zanzibar","mauritius":"Mauritius","seychelles":"the Seychelles",
    // South & Southeast Asia
    "delhi":"Delhi","new delhi":"Delhi","mumbai":"Mumbai","bombay":"Mumbai",
    "bangalore":"Bangalore","bengaluru":"Bangalore","chennai":"Chennai",
    "kolkata":"Kolkata","goa":"Goa","kochi":"Kochi","hyderabad":"Hyderabad",
    "colombo":"Colombo","male":"the Maldives","maldives":"the Maldives",
    "kathmandu":"Kathmandu","dhaka":"Dhaka",
    "bangkok":"Bangkok","phuket":"Phuket","chiang mai":"Chiang Mai",
    "krabi":"Krabi","koh samui":"Koh Samui","singapore":"Singapore",
    "kuala lumpur":"Kuala Lumpur","penang":"Penang","bali":"Bali",
    "denpasar":"Bali","jakarta":"Jakarta","manila":"Manila","cebu":"Cebu",
    "hanoi":"Hanoi","ho chi minh city":"Ho Chi Minh City","saigon":"Ho Chi Minh City",
    "da nang":"Da Nang","phnom penh":"Phnom Penh","siem reap":"Siem Reap",
    "vientiane":"Vientiane","yangon":"Yangon",
    // East Asia
    "hong kong":"Hong Kong","macau":"Macau","tokyo":"Tokyo","osaka":"Osaka",
    "kyoto":"Osaka","sapporo":"Sapporo","fukuoka":"Fukuoka","okinawa":"Okinawa",
    "seoul":"Seoul","busan":"Busan","beijing":"Beijing","peking":"Beijing",
    "shanghai":"Shanghai","guangzhou":"Guangzhou","shenzhen":"Shenzhen",
    "chengdu":"Chengdu","taipei":"Taipei","ulaanbaatar":"Ulaanbaatar",
    // Oceania
    "sydney":"Sydney","melbourne":"Melbourne","brisbane":"Brisbane",
    "perth":"Perth","adelaide":"Adelaide","cairns":"Cairns",
    "auckland":"Auckland","wellington":"Wellington","christchurch":"Christchurch",
    "queenstown":"Queenstown","fiji":"Fiji","nadi":"Fiji",
    // North America
    "new york":"New York","nyc":"New York","boston":"Boston",
    "washington":"Washington DC","washington dc":"Washington DC",
    "philadelphia":"Philadelphia","chicago":"Chicago","detroit":"Detroit",
    "atlanta":"Atlanta","miami":"Miami","orlando":"Orlando","tampa":"Tampa",
    "houston":"Houston","dallas":"Dallas","austin":"Austin","denver":"Denver",
    "phoenix":"Phoenix","las vegas":"Las Vegas","vegas":"Las Vegas",
    "los angeles":"Los Angeles","san francisco":"San Francisco",
    "san diego":"San Diego","seattle":"Seattle","portland":"Portland",
    "honolulu":"Honolulu","hawaii":"Honolulu","anchorage":"Anchorage",
    "toronto":"Toronto","vancouver":"Vancouver","montreal":"Montreal",
    "calgary":"Calgary","ottawa":"Ottawa","quebec":"Quebec City",
    "mexico city":"Mexico City","cdmx":"Mexico City","cancun":"Cancún",
    "cancún":"Cancún","tulum":"Cancún","guadalajara":"Guadalajara",
    "puerto vallarta":"Puerto Vallarta","los cabos":"Los Cabos",
    // Caribbean & Central America
    "havana":"Havana","montego bay":"Montego Bay","kingston":"Kingston",
    "punta cana":"Punta Cana","barbados":"Barbados","bridgetown":"Barbados",
    "antigua":"Antigua","st lucia":"St Lucia","nassau":"Nassau",
    "bahamas":"Nassau","aruba":"Aruba","san juan":"San Juan",
    "panama city":"Panama City","san jose":"San José","costa rica":"San José",
    "belize city":"Belize City","guatemala city":"Guatemala City",
    // South America
    "sao paulo":"São Paulo","são paulo":"São Paulo","rio":"Rio de Janeiro",
    "rio de janeiro":"Rio de Janeiro","brasilia":"Brasília",
    "buenos aires":"Buenos Aires","santiago":"Santiago","lima":"Lima",
    "cusco":"Cusco","cuzco":"Cusco","la paz":"La Paz","quito":"Quito",
    "bogota":"Bogotá","bogotá":"Bogotá","cartagena":"Cartagena",
    "medellin":"Medellín","montevideo":"Montevideo","asuncion":"Asunción",
    "galapagos":"the Galápagos",
    // Short forms people type
    "hk":"Hong Kong","kl":"Kuala Lumpur","sf":"San Francisco",
    "la":"Los Angeles","ny":"New York","dc":"Washington DC","bcn":"Barcelona"
  };

  /* IATA codes. Kept SEPARATE from names, and deliberately NOT collapsed to
     the city: LHR, LGW, STN and LTN are four different fares out of London,
     and Maria's own config tracks them individually — so "LGW to AGP" must
     come back as Gatwick, not as "London". Where a city has one airport the
     city name is the honest answer. */
  var AIRPORTS = {
    // London and the UK
    "lhr":"London Heathrow","lgw":"London Gatwick","stn":"London Stansted",
    "ltn":"London Luton","lcy":"London City","sen":"London Southend",
    "man":"Manchester","edi":"Edinburgh","gla":"Glasgow","bhx":"Birmingham",
    "brs":"Bristol","ncl":"Newcastle","lpl":"Liverpool","lba":"Leeds",
    "bfs":"Belfast","cwl":"Cardiff","abz":"Aberdeen","ema":"East Midlands",
    "gla":"Glasgow","dub":"Dublin","ork":"Cork","snn":"Shannon",
    // Europe
    "cdg":"Paris Charles de Gaulle","ory":"Paris Orly","bva":"Paris Beauvais",
    "ams":"Amsterdam","bru":"Brussels","crl":"Brussels Charleroi",
    "lux":"Luxembourg","gva":"Geneva","zrh":"Zurich","bsl":"Basel",
    "fra":"Frankfurt","muc":"Munich","ber":"Berlin","ham":"Hamburg",
    "cgn":"Cologne","dus":"Düsseldorf","vie":"Vienna","szg":"Salzburg",
    "inn":"Innsbruck",
    "mad":"Madrid","bcn":"Barcelona","svq":"Seville","vlc":"Valencia",
    "bio":"Bilbao","agp":"Málaga","alc":"Alicante","rmu":"Murcia",
    "lei":"Almería","pmi":"Palma","ibz":"Ibiza","mah":"Menorca",
    "lpa":"Gran Canaria","tfs":"Tenerife South","tfn":"Tenerife North",
    "ace":"Lanzarote","fue":"Fuerteventura",
    "lis":"Lisbon","opo":"Porto","fao":"Faro","fnc":"Madeira",
    "fco":"Rome Fiumicino","cia":"Rome Ciampino","mxp":"Milan Malpensa",
    "lin":"Milan Linate","bgy":"Milan Bergamo","vce":"Venice","trv":"Venice Treviso",
    "flr":"Florence","nap":"Naples","trn":"Turin","blq":"Bologna","psa":"Pisa",
    "bri":"Bari","cta":"Catania","pmo":"Palermo","cag":"Sardinia",
    "ath":"Athens","skg":"Thessaloniki","her":"Crete","rho":"Rhodes",
    "cfu":"Corfu","jtr":"Santorini","jmk":"Mykonos","kgs":"Kos","zth":"Zakynthos",
    "spu":"Split","dbv":"Dubrovnik","zag":"Zagreb","tia":"Tirana","lju":"Ljubljana",
    "beg":"Belgrade","sof":"Sofia","otp":"Bucharest",
    "cph":"Copenhagen","arn":"Stockholm","nyo":"Stockholm Skavsta",
    "got":"Gothenburg","osl":"Oslo","trf":"Oslo Torp","bgo":"Bergen",
    "hel":"Helsinki","kef":"Reykjavik","tos":"Tromsø","rix":"Riga",
    "tll":"Tallinn","vno":"Vilnius",
    "prg":"Prague","bud":"Budapest","krk":"Kraków","waw":"Warsaw",
    "wmi":"Warsaw Modlin","gdn":"Gdańsk","wro":"Wrocław","bts":"Bratislava",
    "nce":"Nice","mrs":"Marseille","lys":"Lyon","tls":"Toulouse","bod":"Bordeaux",
    // Türkiye, Middle East, Africa
    "ist":"Istanbul","saw":"Istanbul Sabiha","ayt":"Antalya","adb":"Izmir",
    "dxb":"Dubai","dwc":"Dubai World Central","auh":"Abu Dhabi","doh":"Doha",
    "mct":"Muscat","amm":"Amman","bey":"Beirut","tlv":"Tel Aviv",
    "cai":"Cairo","hrg":"Hurghada","ssh":"Sharm el-Sheikh",
    "rak":"Marrakesh","cmn":"Casablanca","aga":"Agadir","tun":"Tunis",
    "jnb":"Johannesburg","cpt":"Cape Town","dur":"Durban","nbo":"Nairobi",
    "los":"Lagos","acc":"Accra","add":"Addis Ababa","znz":"Zanzibar",
    "mru":"Mauritius","sez":"the Seychelles",
    // Asia
    "del":"Delhi","bom":"Mumbai","blr":"Bangalore","maa":"Chennai",
    "ccu":"Kolkata","goi":"Goa","cok":"Kochi","hyd":"Hyderabad",
    "cmb":"Colombo","mle":"the Maldives","ktm":"Kathmandu","dac":"Dhaka",
    "bkk":"Bangkok","dmk":"Bangkok Don Mueang","hkt":"Phuket","cnx":"Chiang Mai",
    "kbv":"Krabi","usm":"Koh Samui","sin":"Singapore","kul":"Kuala Lumpur",
    "pen":"Penang","dps":"Bali","cgk":"Jakarta","mnl":"Manila","ceb":"Cebu",
    "han":"Hanoi","sgn":"Ho Chi Minh City","dad":"Da Nang","pnh":"Phnom Penh",
    "rep":"Siem Reap","vte":"Vientiane","rgn":"Yangon",
    "hkg":"Hong Kong","mfm":"Macau","nrt":"Tokyo Narita","hnd":"Tokyo Haneda",
    "kix":"Osaka Kansai","itm":"Osaka Itami","cts":"Sapporo","fuk":"Fukuoka",
    "oka":"Okinawa","icn":"Seoul Incheon","gmp":"Seoul Gimpo","pus":"Busan",
    "pek":"Beijing","pkx":"Beijing Daxing","pvg":"Shanghai Pudong",
    "sha":"Shanghai Hongqiao","can":"Guangzhou","szx":"Shenzhen",
    "ctu":"Chengdu","tpe":"Taipei","uln":"Ulaanbaatar",
    // Oceania
    "syd":"Sydney","mel":"Melbourne","bne":"Brisbane","per":"Perth",
    "adl":"Adelaide","cns":"Cairns","akl":"Auckland","wlg":"Wellington",
    "chc":"Christchurch","zqn":"Queenstown","nan":"Fiji",
    // North America
    "jfk":"New York JFK","ewr":"New York Newark","lga":"New York LaGuardia",
    "bos":"Boston","iad":"Washington Dulles","dca":"Washington Reagan",
    "bwi":"Baltimore","phl":"Philadelphia","ord":"Chicago O'Hare",
    "mdw":"Chicago Midway","dtw":"Detroit","atl":"Atlanta","mia":"Miami",
    "fll":"Fort Lauderdale","mco":"Orlando","tpa":"Tampa","iah":"Houston",
    "dfw":"Dallas Fort Worth","dal":"Dallas Love","aus":"Austin","den":"Denver",
    "phx":"Phoenix","las":"Las Vegas","lax":"Los Angeles","sfo":"San Francisco",
    "oak":"Oakland","sjc":"San Jose","san":"San Diego","sea":"Seattle",
    "pdx":"Portland","hnl":"Honolulu","anc":"Anchorage",
    "yyz":"Toronto","yvr":"Vancouver","yul":"Montreal","yyc":"Calgary",
    "yow":"Ottawa","yqb":"Quebec City",
    "mex":"Mexico City","cun":"Cancún","gdl":"Guadalajara","pvr":"Puerto Vallarta",
    "sjd":"Los Cabos",
    // Caribbean & Latin America
    "hav":"Havana","mbj":"Montego Bay","kin":"Kingston","puj":"Punta Cana",
    "bgi":"Barbados","anu":"Antigua","uvf":"St Lucia","nas":"Nassau",
    "aua":"Aruba","sju":"San Juan","pty":"Panama City","sjo":"San José",
    "bze":"Belize City","gua":"Guatemala City",
    "gru":"São Paulo","gig":"Rio de Janeiro","bsb":"Brasília",
    "eze":"Buenos Aires","scl":"Santiago","lim":"Lima","cuz":"Cusco",
    "lpb":"La Paz","uio":"Quito","bog":"Bogotá","ctg":"Cartagena",
    "mde":"Medellín","mvd":"Montevideo","asu":"Asunción","gps":"the Galápagos"
  };

  /* A country is not a destination she can watch — it has several airports and
     the fare depends entirely on which. Naming them separately lets the panel
     say something useful ("Japan is a country — which airport?") instead of
     treating it as a word she has never seen. */
  var COUNTRIES = {
    "japan":"Japan","italy":"Italy","spain":"Spain","france":"France",
    "portugal":"Portugal","greece":"Greece","thailand":"Thailand",
    "india":"India","china":"China","australia":"Australia","morocco":"Morocco",
    "turkey":"Türkiye","türkiye":"Türkiye","germany":"Germany",
    "netherlands":"the Netherlands","holland":"the Netherlands",
    "mexico":"Mexico","brazil":"Brazil","vietnam":"Vietnam","indonesia":"Indonesia",
    "usa":"the USA","america":"the USA","united states":"the USA","uk":"the UK",
    "scotland":"Scotland","wales":"Wales","ireland":"Ireland","croatia":"Croatia",
    "poland":"Poland","norway":"Norway","sweden":"Sweden","denmark":"Denmark",
    "finland":"Finland","iceland":"Iceland","switzerland":"Switzerland",
    "austria":"Austria","belgium":"Belgium","egypt":"Egypt","kenya":"Kenya",
    "south africa":"South Africa","canada":"Canada","argentina":"Argentina",
    "chile":"Chile","peru":"Peru","colombia":"Colombia","cuba":"Cuba",
    "jamaica":"Jamaica","malaysia":"Malaysia","philippines":"the Philippines",
    "singapore":"Singapore","korea":"South Korea","south korea":"South Korea",
    "new zealand":"New Zealand","sri lanka":"Sri Lanka","nepal":"Nepal",
    "cambodia":"Cambodia","laos":"Laos","czechia":"Czechia",
    "czech republic":"Czechia","hungary":"Hungary","romania":"Romania"
  };

  var MONTHS = ["january","february","march","april","may","june","july",
                "august","september","october","november","december"];
  /* "28th Aug-19th Jan" reported no dates at all, because only the full names
     were known. Longest-first within each month so "sept" wins over "sep". */
  var MONTH_ALIASES = [
    ["january",["jan"]], ["february",["feb"]], ["march",["mar"]],
    ["april",["apr"]], ["may",[]], ["june",["jun"]], ["july",["jul"]],
    ["august",["aug"]], ["september",["sept","sep"]], ["october",["oct"]],
    ["november",["nov"]], ["december",["dec"]]
  ];
  var WORD_NUMS = { one:1, two:2, three:3, four:4, five:5, six:6 };

  /* A single total across several legs. This — not the number of cities — is
     what makes something a trip Maria sums rather than separate watches. */
  var WHOLE_TRIP = /\b(?:for\s+)?(?:the\s+)?whole\s+(?:thing|trip|lot|journey)\b|\bfor the lot\b|\bin total\b|\baltogether\b|\ball in\b|\bfor everything\b|\bfor all of it\b|\bcombined\b|\btotal\b/;

  /* Words that end a place phrase. Without these, "Tokyo in April" resolves as
     a city called "Tokyo In April". */
  var STOP = /^(in|on|at|under|below|within|for|around|about|during|next|this|each|per|from|by|before|after|until|till|and|or|with|when|its|it|i|want|know|to|whole|trip|journey|lot|total|altogether|everything|combined|return|returning|outbound)$/;

  var EM = "—";

  /* Levenshtein, small strings only. Exists so that "novermber" is read as a
     date rather than becoming a city called Novermber — which is what happened,
     complete with a confident "she doesn't recognise Novermber" underneath. */
  function editDistance(a, b) {
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function monthIndexOf(w) {
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      if (MONTH_ALIASES[i][0] === w) return i;
      if (MONTH_ALIASES[i][1].indexOf(w) > -1) return i;
    }
    return -1;
  }

  /* Deliberately tight. At distance 2 on a five-letter word, "watch" matches
     "march" — and "Watch London to Tokyo" would sprout a March date out of
     nowhere. So: one edit up to six letters, two only from seven. */
  function fuzzyMonth(w) {
    if (w.length < 5 || CITIES[w] || AIRPORTS[w] || COUNTRIES[w] || STOP.test(w)) return -1;
    var allow = w.length >= 7 ? 2 : 1;
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      var full = MONTH_ALIASES[i][0];
      if (Math.abs(full.length - w.length) > allow) continue;
      if (editDistance(w, full) <= allow) return i;
    }
    return -1;
  }

  function isMonthWord(w) {
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      if (MONTH_ALIASES[i][0] === w) return true;
      if (MONTH_ALIASES[i][1].indexOf(w) > -1) return true;
    }
    return false;
  }

  function titleWords(s) {
    return s.replace(/\S+/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }

  /* Turn one segment of a "A to B to C" chain into a place. Unknown is a
     first-class outcome, not a failure to be swallowed. */
  function resolvePlace(raw) {
    var t = String(raw || "").toLowerCase()
      .replace(/[.!?]+$/, "")
      .replace(/^\s*(please\s+)?(watch|track|monitor|check|find me|i want to (watch|know|go)|i'd like)\s+/, "")
      .replace(/^\s*(from|fly(ing)? (from|to)|go(ing)? to)\s+/, "")
      .replace(/[^a-zà-ÿ'’\- ]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return null;

    // A place phrase ENDS at the first stop-word: "Athens in June" is Athens,
    // not a city called "Athens In June". Trimming only the ends left the
    // whole phrase unresolvable, and an unresolvable phrase was dropped.
    var words = t.split(" ");
    while (words.length && STOP.test(words[0])) words.shift();
    var cut = [];
    for (var wi = 0; wi < words.length; wi++) {
      if (STOP.test(words[wi]) || isMonthWord(words[wi])) break;
      cut.push(words[wi]);
    }
    words = cut;
    t = words.join(" ");
    if (!t) return null;

    if (CITIES[t])    return { name: CITIES[t],    kind: "city" };
    /* Codes after names, so a name that is also a code resolves to the name.
       An IATA hit counts as a city: she knows exactly what it is, and flagging
       LHR as unrecognised was the complaint that prompted all of this. */
    if (AIRPORTS[t])  return { name: AIRPORTS[t],  kind: "city" };
    if (COUNTRIES[t]) return { name: COUNTRIES[t], kind: "country" };
    if (t.length > 20 || words.length > 3) return null;   // a sentence, not a place
    return { name: titleWords(t), kind: "unknown" };
  }

  /* The route is the run of "X to Y to Z" before the first comma. Structure,
     not vocabulary: this finds four legs whether or not it has heard of any
     of them. */
  function chainIn(part) {
    var head = part.split(",")[0];
    if (!/\s+to\s+/i.test(head)) return null;
    var segs = head.split(/\s+to\s+/i);
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var p = resolvePlace(segs[i]);
      if (p) out.push(p);
    }
    return out.length >= 2 ? out : null;
  }

  /* "London to Tokyo, Osaka or Seoul" — destinations listed after the chain,
     sharing its origin. Read only up to the first stop-word or digit, so
     "Osaka or Seoul in April under £600" contributes Osaka and Seoul and not
     the rest of the sentence. */
  function altsAfter(part) {
    var rest = part.slice(part.indexOf(",") + 1);
    if (part.indexOf(",") === -1) return null;
    var take = [];
    rest.trim().split(/\s+/).some(function (w) {
      var bare = w.toLowerCase().replace(/[^a-zà-ÿ'’,-]/gi, "");
      if (/\d/.test(w)) return true;
      if (STOP.test(bare.replace(/,$/, "")) && !/^(or|and)$/.test(bare.replace(/,$/, ""))) return true;
      take.push(w);
      return false;
    });
    var phrase = take.join(" ");
    if (!/\bor\b|\band\b|,/.test(phrase)) return null;
    var names = phrase.split(/\s*,\s*|\s+\bor\b\s+|\s+\band\b\s+/i);
    var resolved = [];
    names.forEach(function (n) { var p = resolvePlace(n); if (p) resolved.push(p); });
    if (resolved.length < 2) return null;
    if (!resolved.some(function (r) { return r.kind === "city"; })) return null;
    return resolved;
  }

  /* Bare destinations with no "to" at all: "Milan, Naples and Athens". */
  function bareList(part) {
    var names = part.split(/\s*,\s*|\s+\bor\b\s+|\s+\band\b\s+/i);
    var resolved = [];
    names.forEach(function (n) {
      var p = resolvePlace(n);
      if (p && (p.kind === "city" || p.kind === "country")) resolved.push(p);
    });
    return resolved.length ? resolved : null;
  }

  /* Price, with or without a currency. "within 200" is a real budget and the
     old version saw no "£" and reported "No number set" — which reads as the
     user having forgotten to give one. The currency being absent is worth
     saying; the number being absent is not the same thing. */
  function trimNum(n) { return String(n).replace(/[,.]+$/, ""); }

  function priceIn(text) {
    var m = text.match(/([£$€])\s?(\d[\d,]*)/);
    // [\d,]* happily swallows the comma that ENDS the clause, so "£555, 28th
    // Aug" produced the amount "555," and rendered as "£555,".
    if (m) return { amount: trimNum(m[2]), symbol: m[1] };
    var w = text.match(/\b(\d[\d,]*)\s?(gbp|pounds?|usd|dollars?|eur|euros?)\b/i);
    if (w) {
      var sym = /gbp|pound/i.test(w[2]) ? "£" : (/usd|dollar/i.test(w[2]) ? "$" : "€");
      return { amount: trimNum(w[1]), symbol: sym };
    }
    var b = text.match(/\b(?:under|within|below|max(?:imum)?|up to|less than|no more than|around|about)\s*(\d[\d,]*)\b/i);
    if (b) return { amount: trimNum(b[1]), symbol: null };
    return null;
  }

  /* Dates, in the order they were TYPED. The old version walked the month
     list January-first and returned whichever came earliest in the calendar,
     so "20th july - may 19" reported "May". */
  function datesIn(text) {
    var low = text.toLowerCase(), hits = [], re = /[a-z\u00e0-\u00ff]+/g, m;
    while ((m = re.exec(low)) !== null) {
      var w = m[0];
      var idx = monthIndexOf(w), fuzzy = false;
      if (idx === -1) { idx = fuzzyMonth(w); fuzzy = idx > -1; }
      if (idx > -1) {
        hits.push({ at: m.index, end: m.index + w.length, idx: idx,
                    label: titleWords(MONTH_ALIASES[idx][0]), fuzzy: fuzzy, raw: w });
      }
    }

    hits.forEach(function (h) {
      var before = low.slice(Math.max(0, h.at - 9), h.at);
      var after  = low.slice(h.end, h.end + 8);
      var d = before.match(/(\d{1,2})(?:st|nd|rd|th)?\s*$/) || after.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (d) h.day = parseInt(d[1], 10);
    });

    return hits;
  }

  /* Rough day count between two (month, day) points, wrapping the year. Only
     needs to be good enough to say "14 nights inside an 18-day window". */
  var MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
  function dayOfYear(idx, day) {
    var n = day || 1;
    for (var i = 0; i < idx; i++) n += MONTH_DAYS[i];
    return n;
  }
  function windowDays(a, b) {
    if (!a || !b || !a.day || !b.day) return null;
    var d = dayOfYear(b.idx, b.day) - dayOfYear(a.idx, a.day);
    return d < 0 ? d + 365 : d;
  }

  /* "3 days in Tokyo, 5 days in Osaka" is an ITINERARY — a single trip through
     all of them, in that order. Read as alternatives it becomes three separate
     watches, which is the opposite of what was asked for. Giving a length of
     stay for each place is the strongest signal in the sentence and it was
     being ignored entirely. */
  function staysIn(text) {
    var out = [], re = /(\d+)\s*(day|days|night|nights|week|weeks)\s+in\s+([a-z\u00e0-\u00ff'\u2019 -]+)/gi, m;
    while ((m = re.exec(text)) !== null) {
      var p = resolvePlace(m[3]);
      if (!p) continue;
      var n = parseInt(m[1], 10);
      if (/week/i.test(m[2])) n *= 7;
      out.push({ nights: n, place: p });
    }
    return out;
  }

  function dateLabel(h) { return (h.day ? h.day + " " : "") + h.label; }

  function whenIn(text) {
    var low = text.toLowerCase();
    var hits = datesIn(text);
    if (hits.length >= 2) {
      var between = low.slice(hits[0].end, hits[1].at);
      var isRange = /[-–—]|(\bto\b)|(\buntil\b)|(\btill\b)|(\bthrough\b)/.test(between);
      return {
        label: dateLabel(hits[0]) + (isRange ? " – " : " and ") + dateLabel(hits[1]),
        hits: hits, range: isRange
      };
    }
    if (hits.length === 1) return { label: rangeWords(low, dateLabel(hits[0])), hits: hits, range: false };
    if (/half\s*term/.test(low)) return { label: "Half term", hits: [], range: false };
    if (/christmas/.test(low))   return { label: "Christmas", hits: [], range: false };
    if (/easter/.test(low))      return { label: "Easter", hits: [], range: false };
    return null;
  }

  function rangeWords(low, label) {
    if (/first two weeks/.test(low))        return "First two weeks of " + label;
    if (/end of/.test(low))                 return "End of " + label;
    if (/start of|beginning of/.test(low))  return "Start of " + label;
    return label;
  }

  function travellersIn(low) {
    var d = low.match(/(\d+)\s*(adults?|people|of us|passengers?|travellers?)/);
    var w = low.match(/\b(one|two|three|four|five|six)\s+(adults?|people|of us|passengers?|travellers?)/);
    if (d) return parseInt(d[1], 10);
    if (w) return WORD_NUMS[w[1]];
    return 1;
  }

  /* " and " / ";" separates two complete asks; a comma does NOT — "Cusco to
     Lima to Cancún, end of March, under £300" is one ask with three commas.
     A fragment naming no place is a continuation, not a new watch. */
  function clauses(text) {
    var parts = text.split(/\s*;\s*|\s+and\s+/i), out = [];
    parts.forEach(function (p) {
      if (!p || !p.trim()) return;
      var hasPlace = chainIn(p) || bareList(p);
      if (!hasPlace && out.length) out[out.length - 1] += " and " + p;
      else out.push(p.trim());
    });
    return out.length ? out : [text];
  }

  function parse(raw) {
    var text = String(raw || "").trim();
    if (!text) {
      return { shape: "empty", watches: [], flags: [], note:
        "Start typing and she’ll pull the route, the dates and your price out of it." };
    }

    var lowAll  = text.toLowerCase();
    var parts   = clauses(text);
    var wholeT  = WHOLE_TRIP.test(lowAll);
    var whenAll = whenIn(text);
    var nAll    = travellersIn(lowAll);
    var each    = /\beach\b|per person|\bpp\b/.test(lowAll);

    var watches = [], flags = [], legs = 0, unknowns = [], countries = [], openAsk = false;

    /* An itinerary beats everything else in the sentence. Giving a length of
       stay for each place says "one trip, in this order" more strongly than
       "or" says "pick one" — people write "Tokyo, Osaka or Seoul" while
       meaning all three, and then spell out the nights. Read as alternatives
       it produced three separate watches, which is the opposite of the ask. */
    var stays = staysIn(text);
    if (stays.length >= 2) {
      var firstChain = chainIn(parts[0]);
      var origin = firstChain ? firstChain[0] : null;
      if (origin) noteUnknownInto(origin, unknowns, countries);
      stays.forEach(function (st) { noteUnknownInto(st.place, unknowns, countries); });

      /* The chain is authoritative for the SEQUENCE when it names more than a
         single destination — "MAN to DXB to SIN to SYD, 5 days in dubai,
         4 days in singapore" lists four stops but only two durations, and
         rebuilding the route from the durations alone silently dropped
         Sydney. Durations describe the stops; they do not define them. */
      var seqPlaces = (firstChain && firstChain.length > 2)
        ? firstChain.slice(1)
        : stays.map(function (st) { return st.place; });
      seqPlaces.forEach(function (pl) { noteUnknownInto(pl, unknowns, countries); });

      var seq = seqPlaces.map(function (pl) { return pl.name; });
      var routeStr = (origin ? origin.name + " → " : "") + seq.join(" → ");
      watches.push({ route: routeStr, when: whenAll, n: nAll, price: priceIn(text) });

      // A stop nobody gave a length for is worth saying out loud — it is the
      // difference between "she has your plan" and "she has most of it".
      var timed = {};
      stays.forEach(function (st) { timed[st.place.name] = true; });
      var untimed = seq.filter(function (nm) { return !timed[nm]; });

      var nights = stays.reduce(function (t, st) { return t + st.nights; }, 0);
      var win = whenAll && whenAll.hits.length >= 2
        ? windowDays(whenAll.hits[0], whenAll.hits[1]) : null;

      flags.push("She’s read that as one trip through all " + seq.length + " stops" +
        (/\bor\b/i.test(text) ? ", not a choice between them — you wrote “or”, but you gave a length of stay for each." : "."));
      flags.push(stays.map(function (st) {
          return st.nights + (st.nights === 1 ? " day in " : " days in ") + st.place.name;
        }).join(", ") + " — " + nights + " days" +
        (win ? " inside a " + win + "-day window, leaving " + (win - nights) + " for travel." : "."));

      if (untimed.length) flags.push("No length of stay for " +
        (untimed.length < 3 ? untimed.join(" or ")
                            : untimed.slice(0, -1).join(", ") + " or " + untimed[untimed.length - 1]) +
        " — she’ll ask how long you want there.");
      if (whenAll) whenAll.hits.forEach(function (h) {
        if (h.fuzzy) flags.push("Reading “" + h.raw + "” as " + h.label + ".");
      });
      if (!priceIn(text)) flags.push("No price yet. Give her a number and she’ll only message you under it.");
      else if (!priceIn(text).symbol) flags.push("You said " + priceIn(text).amount +
        " with no currency — she’ll take that as £" + priceIn(text).amount + " unless you tell her otherwise.");
      if (countries.length) flags.push(countries.join(" and ") +
        (countries.length > 1 ? " are countries" : " is a country") + " — she’ll ask which airport.");
      if (unknowns.length) flags.push("She doesn’t recognise " +
        unknowns.map(function (u) { return "“" + u + "”"; }).join(" or ") + " yet — she’ll check what you meant.");

      return { shape: "trip", watches: watches, flags: flags,
               note: wholeT
                 ? "One trip, not separate flights — she adds the legs up and alerts on the total."
                 : "One trip through " + stays.length + " stops. She’d total the legs unless you give each its own price." };
    }

    function noteUnknownInto(p, unk, ctry) {
      if (p.kind === "unknown" && unk.indexOf(p.name) === -1) unk.push(p.name);
      if (p.kind === "country" && ctry.indexOf(p.name) === -1) ctry.push(p.name);
    }

    function noteUnknown(p) {
      if (p.kind === "unknown" && unknowns.indexOf(p.name) === -1) unknowns.push(p.name);
      if (p.kind === "country" && countries.indexOf(p.name) === -1) countries.push(p.name);
    }

    parts.forEach(function (part) {
      var low   = part.toLowerCase();
      var when  = whenIn(part) || whenAll;
      var n     = travellersIn(low) !== 1 ? travellersIn(low) : nAll;
      var price = priceIn(part) || (parts.length === 1 ? priceIn(text) : null);

      var chain = chainIn(part);
      if (chain) {
        chain.forEach(noteUnknown);
        var alts = altsAfter(part);
        if (chain.length === 2 && alts) {
          alts.forEach(noteUnknown);
          // chain[1] is a destination too — "London to Tokyo, Osaka or Seoul"
          // is three options, not two. Dropping it was the same silent loss
          // this rewrite exists to stop.
          var dests = [chain[1]].concat(alts.filter(function (a) {
            return a.name !== chain[1].name;
          }));
          dests.forEach(function (d) {
            watches.push({ route: chain[0].name + " → " + d.name, when: when, n: n, price: price });
          });
          return;
        }
        legs = Math.max(legs, chain.length - 1);
        watches.push({
          route: chain.map(function (c) { return c.name; }).join(" → "),
          when: when, n: n, price: price
        });
        return;
      }

      var open = low.match(/\b(anywhere|somewhere|wherever)\b/);
      if (open) {
        openAsk = true;
        var vibe = (low.match(/\b(sunny|warm|hot|cheap|beach|snow|skiing|quiet)\b/) || [])[1];
        watches.push({ route: "Anywhere" + (vibe ? " " + vibe : ""), when: when, n: n,
                       price: price, needsOrigin: true });
        return;
      }

      var bare = bareList(part);
      if (bare) {
        bare.forEach(noteUnknown);
        bare.forEach(function (b) {
          watches.push({ route: b.name, when: when, n: n, price: price, needsOrigin: true });
        });
      }
    });

    if (!watches.length) {
      return { shape: "unsure", watches: [], flags: [], note:
        "She didn’t catch a place in that. Name where you’re flying from and to and she’ll take it from there." };
    }

    var shape = watches.length > 1 ? "many" : (legs >= 2 || wholeT ? "trip" : "one");

    /* ---- flags: the things she would come back and check -------------------
       These are shown in the panel, not only mentioned in the note. The whole
       complaint about the old version was that a dropped word was invisible
       unless you happened to read a sentence at the bottom. */

    if (countries.length) {
      flags.push(countries.join(" and ") + (countries.length > 1 ? " are countries" : " is a country") +
                 " — she’ll ask which airport, because the fare depends on it.");
    }
    if (unknowns.length) {
      flags.push("She doesn’t recognise " +
        unknowns.map(function (u) { return "“" + u + "”"; }).join(" or ") +
        " yet — she’ll check what you meant rather than guess.");
    }

    var priced = watches.filter(function (w) { return w.price; });
    if (priced.length && !priced[0].price.symbol) {
      flags.push("You said " + priced[0].price.amount + " with no currency — she’ll take that as £" +
                 priced[0].price.amount + " unless you tell her otherwise.");
    }
    if (!priced.length) {
      flags.push("No price yet. Give her a number and she’ll only message you under it.");
    }

    if (whenAll && whenAll.hits.length >= 2 && whenAll.range) {
      var a = whenAll.hits[0], b = whenAll.hits[1];
      // A range whose second month is earlier in the calendar has crossed the
      // new year — which is ordinary for a long trip, not an error. Say which
      // reading she is taking rather than accusing them of typing it wrong.
      var span = (b.idx - a.idx + 12) % 12;
      if (b.idx < a.idx) {
        flags.push("That crosses the new year — she’ll read it as " + dateLabel(a) +
                   " to " + dateLabel(b) + " the following year. Say so if you meant two separate trips.");
      }
      if (span > 5) {
        flags.push("That’s a " + span + "-month window — she’ll ask whether you want one long stay, " +
                   "or the cheapest week anywhere inside it.");
      }
    } else if (whenAll && whenAll.hits.length >= 2 && !whenAll.range) {
      flags.push("You named two dates — she’ll ask which is the outbound and which the return.");
    }
    if (!whenAll) {
      flags.push("No dates yet — she’ll ask when you want to go.");
    }
    if (watches.some(function (w) { return w.needsOrigin; }) && !openAsk) {
      flags.push("She’ll ask which airport you’re leaving from.");
    } else if (openAsk) {
      flags.push("She’ll ask where you’re flying from, then suggest somewhere that fits.");
    }

    /* "Tokyo, Osaka or Seoul" says pick one; "whole trip £555" says add them
       up. Both cannot be true, and neither reading is safe to assume — one
       watches three fares against £555 each, the other watches a single
       journey totalling £555. So say so instead of silently choosing. */
    if (shape === "many" && wholeT) {
      flags.push("You’ve said “or” — a choice of destinations — but given one whole-trip total. " +
                 "She’ll ask whether that’s the budget for whichever one you pick, or for a single " +
                 "journey through all of them.");
    }

    /* ---- the headline sentence -------------------------------------------- */
    var distinct = {};
    priced.forEach(function (w) { distinct[w.price.amount] = 1; });
    var nDistinct = Object.keys(distinct).length;

    var note;
    if (shape === "many" && nDistinct > 1) {
      note = "That’s " + watches.length + " separate watches, each with its own price. " +
             "She alerts on them independently — one going cheap doesn’t wait for the other.";
    } else if (shape === "many") {
      note = "That’s " + watches.length + " separate watches" +
             (nDistinct === 1 && priced.length === watches.length ? " sharing one price." : ".");
    } else if (shape === "trip" && wholeT) {
      note = "One trip, not separate flights — she adds the legs up and alerts on the total.";
    } else if (shape === "trip") {
      note = (legs + 1) + " stops with one price, so she’d treat it as one trip and total the legs. " +
             "Say “each” if you meant a separate limit per flight.";
    } else if (!flags.length) {
      note = "That’s enough to start. She’d check it at 06:30 and 18:30 from today.";
    } else {
      note = "She’s got the shape of it. The rest she’d ask you:";
    }

    return { shape: shape, watches: watches, flags: flags, note: note };
  }

  /* ---------- render ------------------------------------------------------ */

  var tryInput = document.getElementById("try-input");
  if (tryInput) {
    var slots = {};
    document.querySelectorAll("[data-parsed]").forEach(function (el) { slots[el.dataset.parsed] = el; });
    var listEl   = document.querySelector("[data-parsed-list]");
    var singleEl = document.querySelector("[data-parsed-single]");
    var flagsEl  = document.querySelector("[data-parsed-flags]");
    var labelEl  = document.querySelector("[data-threshold-label]");
    var goEl     = document.querySelector("[data-demo-go]");
    var goLink   = document.querySelector("[data-demo-tg]");
    var goEmail  = document.querySelector("[data-demo-email]");
    var counted  = false;

    /* A number with no currency is shown as "£200?" rather than "£200": the
       question mark is the difference between what she was told and what she
       is assuming, and the flag below says so in words. */
    function fmtPrice(w) {
      if (!w.price) return "Not set yet";
      var sym = w.price.symbol || "£";
      return sym + w.price.amount + (w.price.symbol ? "" : "?") +
             (w.each && w.n > 1 ? " each" : "");
    }

    function render() {
      var out = parse(tryInput.value);
      if (slots.note) slots.note.textContent = out.note;

      var many = out.watches.length > 1;
      if (singleEl) singleEl.hidden = many;
      if (listEl)   listEl.hidden = !many;

      if (many && listEl) {
        listEl.innerHTML = "";
        out.watches.forEach(function (w) {
          var row = document.createElement("div");
          row.className = "watch";
          var r = document.createElement("span");
          r.className = "watch__route";
          r.textContent = w.route;
          var meta = document.createElement("span");
          meta.className = "watch__meta";
          var bits = [];
          if (w.needsOrigin) bits.push("from?");
          bits.push(w.when ? w.when.label : "when?");
          bits.push(fmtPrice(w));
          meta.textContent = bits.join(" · ");
          row.appendChild(r); row.appendChild(meta);
          listEl.appendChild(row);
        });
      } else {
        var w = out.watches[0];
        if (slots.route)     slots.route.textContent = w ? w.route : EM;
        if (slots.when)      slots.when.textContent  = w && w.when ? w.when.label : (w ? "Not set yet" : EM);
        if (slots.who)       slots.who.textContent   = w ? w.n + (w.n === 1 ? " traveller" : " travellers") : "1 traveller";
        if (slots.threshold) slots.threshold.textContent = w ? fmtPrice(w) : EM;
        // £300 across three legs is a whole-trip total; calling that "alert me
        // under" would read as a per-flight limit.
        if (labelEl) labelEl.textContent = out.shape === "trip" ? "Whole trip under" : "Alert me under";
      }

      /* The flags are the point of this rewrite. Anything she could not read,
         had to assume, or would come back and ask about is stated here, in
         the panel — not buried in a sentence underneath it, and never left
         out. A demo that quietly drops a word teaches exactly the wrong thing
         about the thing it is demonstrating. */
      if (flagsEl) {
        flagsEl.innerHTML = "";
        flagsEl.hidden = !out.flags.length;
        out.flags.forEach(function (f) {
          var li = document.createElement("li");
          li.textContent = f;
          flagsEl.appendChild(li);
        });
      }

      /* The panel is only a dead end while there is nothing to act on. As
         soon as she has read a route out of the text, offer the actual next
         step, carrying the visitor's own words into the chat.

         Guarded on window.Maria rather than assumed: maria-core.js is a
         separate request and app.js must degrade to the old behaviour (a
         demo that demonstrates and nothing more) rather than throwing
         halfway through render() and freezing the live panel. */
      var ready = out.watches.length > 0 && !!window.Maria;
      if (goEl) goEl.hidden = !ready;
      if (ready && goLink) {
        goLink.href = window.Maria.tgLink(tryInput.value, "web");
        /* Once per visit, not per keystroke — this fires on every input
           event. Without it there is no way to tell whether the strongest
           thing on the page is being used at all. */
        if (!counted) { counted = true; window.Maria.track("demo-parsed", "Landing demo"); }
      }
    }

    tryInput.addEventListener("input", render);

    var EXAMPLES = [
      "Anywhere sunny in half term, two of us, under £400 each",
      "Watch London to Tokyo, first two weeks of April, under £600",
      "Cusco to Lima to Cancún, end of March, under £300 for the lot",
      "Tokyo under £600 and Lisbon under £90"
    ];
    var chips = document.getElementById("try-chips");
    if (chips) {
      EXAMPLES.forEach(function (label) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = label;
        b.addEventListener("click", function () { tryInput.value = label; render(); });
        chips.appendChild(b);
      });
    }

    /* The slower door out of the demo, for someone who would rather have the
       link in their inbox than open Telegram now. The route goes over in
       sessionStorage, not ?route=, for the same reason the email does — see
       cleanUrl() in analytics.js. */
    if (goEmail) {
      goEmail.addEventListener("click", function () {
        try { sessionStorage.setItem("am_demo_route", tryInput.value.trim()); } catch (e) {}
        if (window.Maria) window.Maria.track("demo-to-email", "Landing demo");
        location.href = "invite.html";
      });
    }

    render();
  }

  /* ---------- hero and footer signup --------------------------------------
     One step, not two. These forms used to be a plain GET to invite.html,
     which meant the address was not captured until the SECOND page — so
     anyone who typed their email here and then hesitated on invite.html was
     lost completely, with nothing left to follow up on. The email is posted
     here and now; the route is optional and comes later, in the demo box
     above or from Maria's first message.

     If maria-core.js failed to load, or there is no endpoint configured, this
     does NOT preventDefault: the native GET to invite.html still runs and the
     visitor lands on the old two-step path rather than on a button that does
     nothing. */
  function wireSignup(form) {
    if (!form) return;
    var renderedAt = Date.now();

    form.addEventListener("submit", function (e) {
      var M = window.Maria;
      if (!M || !M.hasEndpoint()) return;          // fall through to invite.html

      var input = form.querySelector('input[name="email"]');
      var email = input ? String(input.value || "").trim() : "";
      if (!email) return;                          // let the browser complain

      e.preventDefault();

      /* Same timing guard as the invite form, and safer here: this field
         starts empty, so a genuine visitor cannot read the page and type an
         address inside 1.2s. Fails the way that one does — pretend it
         worked, post nothing, and never tell whoever wrote the bot why. */
      var tooFast = Date.now() - renderedAt < 1200;

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }

      var done = function (posted) {
        /* No route from here, and posted says whether an email is genuinely
           on its way — confirmed.html reads both and must not claim an email
           it did not send. Access never depends on this succeeding. */
        M.handOff(email, "", posted);
        location.href = "confirmed.html";
      };

      if (tooFast) { done(false); return; }

      /* consent is deliberately omitted, not false: this form has no
         marketing tick, and writing "no" from a form that never asked would
         revoke a "yes" the same person gave on the invite form. */
      M.postSignup({ email: email }).then(function (ok) {
        M.track(ok ? "hero-signup" : "hero-signup-failed", "Landing signup");
        done(ok);
      });
    });
  }

  wireSignup(document.getElementById("hero-form"));
  wireSignup(document.getElementById("hero-form-foot"));
})();
