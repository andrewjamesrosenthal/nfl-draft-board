#!/usr/bin/env tsx
/**
 * Seeds community rankings from an expert big board, then runs Elo simulation.
 *
 * Step 1: Convert the expert rank list to initial Elo ratings.
 *         Rank 1 → ~1850, Rank 472 → ~1350, spread is roughly linear
 *         so the simulation has a realistic starting point instead of flat 1500.
 *
 * Step 2: Run N simulated pairwise matchups in memory using the seeded ratings.
 *         Uses Elo expected probability + 20% noise to simulate human variance.
 *
 * Step 3: Bulk-write final ratings back to CommunityRanking and recompute ranks.
 *
 * Usage:
 *   npx tsx scripts/seed-from-bigboard.ts --year 2026 --votes 10000
 */
import db from "../src/lib/db";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] ?? "true"]);
    return acc;
  }, []),
);

const YEAR    = Number(args.year  ?? 2026);
const N_VOTES = Number(args.votes ?? 10000);
const NOISE   = 0.20; // fraction of outcomes that go against Elo expectation

// Expert big board — rank, name, school, position
const BIG_BOARD: [number, string, string, string][] = [
  [1,"Fernando Mendoza","Indiana","QB"],
  [2,"Rueben Bain Jr.","Miami (Fla.)","EDGE"],
  [3,"Arvell Reese","Ohio State","EDGE"],
  [4,"Kadyn Proctor","Alabama","OT"],
  [5,"Spencer Fano","Utah","OT"],
  [6,"Jermod McCoy","Tennessee","CB"],
  [7,"Jeremiyah Love","Notre Dame","RB"],
  [8,"Caleb Downs","Ohio State","S"],
  [9,"Sonny Styles","Ohio State","LB"],
  [10,"Avieon Terrell","Clemson","CB"],
  [11,"Ty Simpson","Alabama","QB"],
  [12,"KC Concepcion","Texas A&M","WR"],
  [13,"Caleb Lomu","Utah","OT"],
  [14,"Mansoor Delane","LSU","CB"],
  [15,"Olaivavega Ioane","Penn State","IOL"],
  [16,"Francis Mauigoa","Miami (Fla.)","OT"],
  [17,"Makai Lemon","USC","WR"],
  [18,"Carnell Tate","Ohio State","WR"],
  [19,"Peter Woods","Clemson","DT"],
  [20,"David Bailey","Texas Tech","EDGE"],
  [21,"Omar Cooper Jr.","Indiana","WR"],
  [22,"Emmanuel McNeil-Warren","Toledo","S"],
  [23,"Jordyn Tyson","Arizona St.","WR"],
  [24,"Kenyon Sadiq","Oregon","TE"],
  [25,"Monroe Freeling","Georgia","OT"],
  [26,"D'Angelo Ponds","Indiana","CB"],
  [27,"Chris Johnson","San Diego St.","CB"],
  [28,"Lee Hunter","Texas Tech","DT"],
  [29,"Blake Miller","Clemson","OT"],
  [30,"Akheem Mesidor","Miami (Fla.)","EDGE"],
  [31,"Max Iheanachor","Arizona St.","OT"],
  [32,"Kayden McDonald","Ohio State","DT"],
  [33,"Cashius Howell","Texas A&M","EDGE"],
  [34,"Gabe Jacas","Illinois","EDGE"],
  [35,"Treydan Stukes","Arizona","CB"],
  [36,"Keylan Rutledge","Georgia Tech","IOL"],
  [37,"R Mason Thomas","Oklahoma","EDGE"],
  [38,"Jake Golday","Cincinnati","LB"],
  [39,"Chase Bisontis","Texas A&M","IOL"],
  [40,"Germie Bernard","Alabama","WR"],
  [41,"Josiah Trotter","Missouri","LB"],
  [42,"Antonio Williams","Clemson","WR"],
  [43,"Connor Lew","Auburn","IOL"],
  [44,"Keith Abney II","Arizona St.","CB"],
  [45,"Denzel Boston","Washington","WR"],
  [46,"Keldric Faulk","Auburn","EDGE"],
  [47,"Dillon Thieneman","Oregon","S"],
  [48,"CJ Allen","Georgia","LB"],
  [49,"Trey Zuhn III","Texas A&M","IOL"],
  [50,"Brenen Thompson","Miss. State","WR"],
  [51,"Brandon Cisse","South Carolina","CB"],
  [52,"Malachi Lawrence","UCF","LB"],
  [53,"Caleb Tiernan","Northwestern","OT"],
  [54,"Keyron Crawford","Auburn","EDGE"],
  [55,"Jacob Rodriguez","Texas Tech","LB"],
  [56,"Christen Miller","Georgia","DT"],
  [57,"Anthony Hill Jr.","Texas","LB"],
  [58,"Sam Hecht","Kansas State","IOL"],
  [59,"Colton Hood","Tennessee","CB"],
  [60,"Kyle Louis","Pittsburgh","LB"],
  [61,"Genesis Smith","Arizona","S"],
  [62,"Jadarian Price","Notre Dame","RB"],
  [63,"Malachi Fields","Notre Dame","WR"],
  [64,"A.J. Haulcy","LSU","S"],
  [65,"Emmanuel Pregnon","Oregon","IOL"],
  [66,"Jaishawn Barham","Michigan","LB"],
  [67,"Max Klare","Ohio State","TE"],
  [68,"Keionte Scott","Miami (Fla.)","S"],
  [69,"Garrett Nussmeier","LSU","QB"],
  [70,"Ephesians Prysock","Washington","CB"],
  [71,"Kaleb Proctor","SE Louisiana","DT"],
  [72,"Derrick Moore","Michigan","EDGE"],
  [73,"Cole Payton","N. Dakota St.","QB"],
  [74,"Zachariah Branch","Georgia","WR"],
  [75,"T.J. Parker","Clemson","EDGE"],
  [76,"Bud Clark","TCU","S"],
  [77,"Gracen Halton","Oklahoma","DT"],
  [78,"Romello Height","Texas Tech","EDGE"],
  [79,"Travis Burke","Memphis","OT"],
  [80,"Chris McClellan","Missouri","DT"],
  [81,"Daylen Everette","Georgia","CB"],
  [82,"Jadon Canady","Oregon","CB"],
  [83,"Cyrus Allen","Cincinnati","WR"],
  [84,"Chris Brazzell II","Tennessee","WR"],
  [85,"Austin Barber","Florida","OT"],
  [86,"Nate Boerkircher","Texas A&M","TE"],
  [87,"Billy Schrauth","Notre Dame","IOL"],
  [88,"Keagen Trost","Missouri","IOL"],
  [89,"Domonique Orange","Iowa St.","DT"],
  [90,"Markel Bell","Miami (Fla.)","OT"],
  [91,"Eli Stowers","Vanderbilt","TE"],
  [92,"Caleb Banks","Florida","DT"],
  [93,"Malik Muhammad","Texas","CB"],
  [94,"Joshua Josephs","Tennessee","EDGE"],
  [95,"Alex Harkey","Oregon","IOL"],
  [96,"Parker Brailsford","Alabama","IOL"],
  [97,"Jayden Loving","Wake Forest","DT"],
  [98,"Carver Willis","Washington","OT"],
  [99,"Zion Young","Missouri","EDGE"],
  [100,"Anthony Lucas","USC","EDGE"],
  [101,"Elijah Sarratt","Indiana","WR"],
  [102,"Eli Heidenreich","Navy","RB"],
  [103,"Jimmy Rolder","Michigan","LB"],
  [104,"Sam Roush","Stanford","TE"],
  [105,"Rayshaun Benny","Michigan","DT"],
  [106,"Eric Rivers","Georgia Tech","WR"],
  [107,"Chandler Rivers","Duke","CB"],
  [108,"Dani Dennis-Sutton","Penn State","EDGE"],
  [109,"Kevin Coleman Jr.","Missouri","WR"],
  [110,"Jake Slaughter","Florida","IOL"],
  [111,"Jalen Farmer","Kentucky","IOL"],
  [112,"Tyler Onyedim","Texas A&M","DT"],
  [113,"Julian Neal","Arkansas","CB"],
  [114,"Chris Bell","Louisville","WR"],
  [115,"Devin Moore","Florida","CB"],
  [116,"Kaytron Allen","Penn State","RB"],
  [117,"Taylen Green","Arkansas","QB"],
  [118,"Nick Barrett","South Carolina","DT"],
  [119,"Ja'Kobi Lane","USC","WR"],
  [120,"De'Zhaun Stribling","Ole Miss","WR"],
  [121,"Oscar Delp","Georgia","TE"],
  [122,"Keyshaun Elliott","Arizona St.","LB"],
  [123,"Jackson Kuwatch","Miami-OH","LB"],
  [124,"Justin Joly","NC State","TE"],
  [125,"Eric McAlister","TCU","WR"],
  [126,"Jager Burton","Kentucky","IOL"],
  [127,"Mason Reiger","Wisconsin","LB"],
  [128,"Jonah Coleman","Washington","RB"],
  [129,"Will Kacmarek","Ohio State","TE"],
  [130,"Gavin Ortega","Weber St.","OT"],
  [131,"Jude Bowry","Boston College","OT"],
  [132,"Jalon Kilgore","South Carolina","S"],
  [133,"Colbie Young","Georgia","WR"],
  [134,"Febechi Nwaiwu","Oklahoma","IOL"],
  [135,"Dontay Corleone","Cincinnati","DT"],
  [136,"Skyler Bell","UConn","WR"],
  [137,"Kaleb Elarms-Orr","TCU","LB"],
  [138,"David Gusta","Kentucky","DT"],
  [139,"Kamari Ramsey","USC","S"],
  [140,"Albert Regis","Texas A&M","DT"],
  [141,"Dallen Bentley","Utah","TE"],
  [142,"Vinny Anthony II","Wisconsin","WR"],
  [143,"Seth McGowan","Kentucky","RB"],
  [144,"Demond Claiborne","Wake Forest","RB"],
  [145,"Logan Jones","Iowa","IOL"],
  [146,"Ar'maj Reed-Adams","Texas A&M","IOL"],
  [147,"Tacario Davis","Washington","CB"],
  [148,"Eli Raridon","Notre Dame","TE"],
  [149,"Deion Burks","Oklahoma","WR"],
  [150,"Bakyne Coly","Purdue","OT"],
  [151,"Red Murdock","Buffalo","LB"],
  [152,"Mike Washington Jr.","Arkansas","RB"],
  [153,"Dametrious Crownover","Texas A&M","OT"],
  [154,"Bryce Lance","N. Dakota St.","WR"],
  [155,"Ted Hurst","Georgia St.","WR"],
  [156,"Zakee Wheatley","Penn State","S"],
  [157,"Drew Allar","Penn State","QB"],
  [158,"Nadame Tucker","W. Michigan","EDGE"],
  [159,"DeVonta Smith","Notre Dame","CB"],
  [160,"Kendrick Law","Kentucky","WR"],
  [161,"Brian Parker II","Duke","IOL"],
  [162,"Fernando Carmona","Arkansas","IOL"],
  [163,"Will Lee III","Texas A&M","CB"],
  [164,"Zxavian Harris","Ole Miss","DT"],
  [165,"Michael Trigg","Baylor","TE"],
  [166,"Gennings Dunker","Iowa","IOL"],
  [167,"Jeff Caldwell","Cincinnati","WR"],
  [168,"Jeremiah Wright","Auburn","IOL"],
  [169,"Matt Gulbin","Michigan St.","IOL"],
  [170,"Davison Igbinosun","Ohio State","CB"],
  [171,"Drew Shelton","Penn State","OT"],
  [172,"Andre Fuller","Toledo","CB"],
  [173,"Emmett Johnson","Nebraska","RB"],
  [174,"Caden Curry","Ohio State","EDGE"],
  [175,"J.C. Davis","Illinois","OT"],
  [176,"Harold Perkins Jr.","LSU","LB"],
  [177,"Taurean York","Texas A&M","LB"],
  [178,"Jack Endries","Texas","TE"],
  [179,"Reggie Virgil","Texas Tech","WR"],
  [180,"Logan Taylor","Boston College","IOL"],
  [181,"Zane Durant","Penn State","DT"],
  [182,"Skyler Gill-Howard","Texas Tech","DT"],
  [183,"Isaiah World","Oregon","OT"],
  [184,"Clay Patterson","Stanford","DT"],
  [185,"Marlin Klein","Michigan","TE"],
  [186,"Joe Royer","Cincinnati","TE"],
  [187,"Lance Mason","Wisconsin","TE"],
  [188,"Jordan van den Berg","Georgia Tech","DT"],
  [189,"Kage Casey","Boise St.","IOL"],
  [190,"DeMonte Capehart","Clemson","DT"],
  [191,"Deontae Lawson","Alabama","LB"],
  [192,"Pat Coogan","Indiana","IOL"],
  [193,"Beau Stephens","Iowa","IOL"],
  [194,"Adam Randall","Clemson","RB"],
  [195,"Darrell Jackson Jr.","Florida State","DT"],
  [196,"LT Overton","Alabama","DT"],
  [197,"Zavion Thomas","LSU","WR"],
  [198,"Josh Cuevas","Alabama","TE"],
  [199,"Hezekiah Masses","California","CB"],
  [200,"Bishop Fitzgerald","USC","S"],
  [201,"Aaron Anderson","LSU","WR"],
  [202,"Carson Beck","Miami (Fla.)","QB"],
  [203,"Robert Henry Jr.","UTSA","RB"],
  [204,"Robert Spears-Jennings","Oklahoma","S"],
  [205,"Tyreak Sapp","Florida","LB"],
  [206,"Dae'Quan Wright","Ole Miss","TE"],
  [207,"VJ Payne","Kansas State","S"],
  [208,"Tyren Montgomery","John Carroll","WR"],
  [209,"Jakobe Thomas","Miami (Fla.)","S"],
  [210,"Michael Taaffe","Texas","S"],
  [211,"Aamil Wagner","Notre Dame","OT"],
  [212,"Nicholas Singleton","Penn State","RB"],
  [213,"Trey Moore","Texas","LB"],
  [214,"Tim Keenan III","Alabama","DT"],
  [215,"Collin Wright","Stanford","CB"],
  [216,"Will Pauling","Notre Dame","WR"],
  [217,"Josh Cameron","Baylor","WR"],
  [218,"Bryson Eason","Tennessee","DT"],
  [219,"Caden Barnett","Wyoming","IOL"],
  [220,"Justin Jefferson","Alabama","LB"],
  [221,"Wesley Bailey","Louisville","EDGE"],
  [222,"James Thompson Jr.","Illinois","DT"],
  [223,"Wade Woodaz","Clemson","LB"],
  [224,"Logan Fano","Utah","EDGE"],
  [225,"Brandon Cleveland","NC State","DT"],
  [226,"Bryce Boettcher","Oregon","LB"],
  [227,"Cade Klubnik","Clemson","QB"],
  [228,"Cian Slone","NC State","LB"],
  [229,"Anez Cooper","Miami (Fla.)","IOL"],
  [230,"Jalen Huskey","Maryland","S"],
  [231,"Riley Mahlman","Wisconsin","OT"],
  [232,"Brent Austin","California","CB"],
  [233,"Tanner Koziol","Houston","TE"],
  [234,"Enrique Cruz Jr.","Kansas","OT"],
  [235,"Rene Konga","Louisville","DT"],
  [236,"Louis Moore","Indiana","S"],
  [237,"Max Llewellyn","Iowa","EDGE"],
  [238,"Kahlil Benson","Indiana","OT"],
  [239,"Matthew Hibner","SMU","TE"],
  [240,"Diego Pounds","Ole Miss","OT"],
  [241,"Barion Brown","LSU","WR"],
  [242,"Jacob Rizy","Florida State","IOL"],
  [243,"Malik Benson","Oregon","WR"],
  [244,"J. Michael Sturdivant","Florida","WR"],
  [245,"Fa'alili Fa'amoe","Wake Forest","OT"],
  [246,"Chris Adams","Memphis","IOL"],
  [247,"Max Tomczak","Youngstown St.","WR"],
  [248,"Devon Marshall","NC State","CB"],
  [249,"Ethan Burke","Texas","EDGE"],
  [250,"Ahmari Harvey","Georgia Tech","CB"],
  [251,"TJ Hall","Iowa","CB"],
  [252,"Lorenzo Styles Jr.","Ohio State","CB"],
  [253,"Latrell McCutchin Sr.","Houston","CB"],
  [254,"Jam Miller","Alabama","RB"],
  [255,"Domani Jackson","Alabama","CB"],
  [256,"Thaddeus Dixon","North Carolina","CB"],
  [257,"Josh Thompson","LSU","IOL"],
  [258,"Jack Kelly","BYU","LB"],
  [259,"Le'Veon Moss","Texas A&M","RB"],
  [260,"Quintayvious Hutchins","Boston College","EDGE"],
  [261,"James Brockermeyer","Miami (Fla.)","IOL"],
  [262,"Romello Brinson","SMU","WR"],
  [263,"Micah Morris","Georgia","IOL"],
  [264,"Xavian Sorey Jr.","Arkansas","LB"],
  [265,"DJ Campbell","Texas","IOL"],
  [266,"Scooby Williams","Texas A&M","LB"],
  [267,"Roman Hemby","Indiana","RB"],
  [268,"Aiden Fisher","Indiana","LB"],
  [269,"Sawyer Robertson","Baylor","QB"],
  [270,"Jaeden Roberts","Alabama","IOL"],
  [271,"Harrison Wallace III","Ole Miss","WR"],
  [272,"Jalen McMurray","Tennessee","CB"],
  [273,"Garrett DiGiorgio","UCLA","IOL"],
  [274,"CJ Daniels","Miami (Fla.)","WR"],
  [275,"Cameron Ball","Arkansas","DT"],
  [276,"Deven Eastern","Minnesota","DT"],
  [277,"Damonic Williams","Oklahoma","DT"],
  [278,"Namdi Obiazor","TCU","LB"],
  [279,"Lake McRee","USC","TE"],
  [280,"George Gumbs Jr.","Florida","EDGE"],
  [281,"DJ Rogers","TCU","TE"],
  [282,"Chase Roberts","BYU","WR"],
  [283,"Charles Demmings","S.F. Austin","CB"],
  [284,"DeShon Singleton","Nebraska","S"],
  [285,"Jayden Williams","Ole Miss","IOL"],
  [286,"Ahmaad Moses","SMU","S"],
  [287,"Jeffrey M'ba","SMU","DT"],
  [288,"Riley Nowakowski","Indiana","TE"],
  [289,"Jaylon Guilbeau","Texas","CB"],
  [290,"Gary Smith III","UCLA","DT"],
  [291,"Toriano Pride Jr.","Missouri","CB"],
  [292,"Dalton Johnson","Arizona","S"],
  [293,"Kendal Daniels","Oklahoma","LB"],
  [294,"Micah Pettus","Florida State","OT"],
  [295,"Jackie Marshall","Baylor","DT"],
  [296,"Kaelon Black","Indiana","RB"],
  [297,"Patrick Payton","LSU","EDGE"],
  [298,"Dane Key","Nebraska","WR"],
  [299,"Caullin Lacy","Louisville","WR"],
  [300,"Michael Heldman","C. Michigan","EDGE"],
  [301,"Emmanuel Henderson Jr.","Kansas","WR"],
  [302,"Ike Larsen","Utah St.","S"],
  [303,"Aaron Graves","Iowa","DT"],
  [304,"Khalil Jacobs","Missouri","LB"],
  [305,"Nyjalik Kelly","UCF","LB"],
  [306,"Josh Moten","So. Miss","CB"],
  [307,"Rasheed Miller","Louisville","OT"],
  [308,"Josh Gesky","Illinois","IOL"],
  [309,"Gary Bryant Jr.","Oregon","WR"],
  [310,"Jarod Washington","SC State","CB"],
  [311,"Aaron Hall","Duke","DT"],
  [312,"Caleb Douglas","Texas Tech","WR"],
  [313,"Xavier Nwankpa","Iowa","S"],
  [314,"Joey Aguilar","Tennessee","QB"],
  [315,"Kaden Wetjen","Iowa","WR"],
  [316,"Nolan Rucci","Penn State","OT"],
  [317,"Haynes King","Georgia Tech","QB"],
  [318,"Mikail Kamara","Indiana","DT"],
  [319,"Luke Altmyer","Illinois","QB"],
  [320,"Mark Gronowski","Iowa","QB"],
  [321,"Ethan Onianwa","Ohio State","IOL"],
  [322,"John Michael Gyllenborg","Wyoming","TE"],
  [323,"Landon Robinson","Navy","DT"],
  [324,"Avery Smith","Toledo","CB"],
  [325,"Noah Thomas","Georgia","WR"],
  [326,"Owen Heinecke","Oklahoma","LB"],
  [327,"Chip Trayanum","Toledo","RB"],
  [328,"Evan Beerntsen","Northwestern","IOL"],
  [329,"Dillon Wade","Auburn","IOL"],
  [330,"Alan Herron","Maryland","OT"],
  [331,"Lander Barton","Utah","LB"],
  [332,"Eric Gentry","USC","LB"],
  [333,"Ricardo Hallman","Wisconsin","CB"],
  [334,"RJ Maryland","SMU","TE"],
  [335,"Joshua Braun","Kentucky","IOL"],
  [336,"Desmond Reid","Pittsburgh","RB"],
  [337,"Jaydn Ott","Oklahoma","RB"],
  [338,"Tristan Leigh","Clemson","OT"],
  [339,"Bobby Jamison-Travis","Auburn","DT"],
  [340,"Skyler Thomas","Oregon State","S"],
  [341,"Athan Kaliakmanis","Rutgers","QB"],
  [342,"Wesley Bissainthe","Miami (Fla.)","LB"],
  [343,"Marcus Allen","North Carolina","CB"],
  [344,"J'Mari Taylor","Virginia","RB"],
  [345,"Karson Sharar","Iowa","LB"],
  [346,"Lewis Bond","Boston College","WR"],
  [347,"Jordan Hudson","SMU","WR"],
  [348,"Devin Voisin","South Alabama","WR"],
  [349,"Jalen Stroman","Notre Dame","S"],
  [350,"Rahsul Faison","South Carolina","RB"],
  [351,"Dillon Bell","Georgia","WR"],
  [352,"Jack Pyburn","LSU","EDGE"],
  [353,"Jalen Walthall","Incarnate Word","WR"],
  [354,"Seydou Traore","Miss. State","TE"],
  [355,"Ceyair Wright","Nebraska","CB"],
  [356,"Wesley Williams","Duke","EDGE"],
  [357,"Jaren Kanak","Oklahoma","TE"],
  [358,"Aidan Hubbard","Northwestern","EDGE"],
  [359,"Noah Whittington","Oregon","RB"],
  [360,"Delby Lemieux","Dartmouth","IOL"],
  [361,"CJ Donaldson","Ohio State","RB"],
  [362,"Wydett Williams Jr.","Ole Miss","S"],
  [363,"Joe Fagnano","UConn","QB"],
  [364,"Miles Kitselman","Tennessee","TE"],
  [365,"Behren Morton","Texas Tech","QB"],
  [366,"Jaden Dugger","Louisiana","LB"],
  [367,"Fred Davis II","Northwestern","CB"],
  [368,"Bauer Sharp","LSU","TE"],
  [369,"Kejon Owens","FIU","RB"],
  [370,"Max Bredeson","Michigan","TE"],
  [371,"Marvin Jones Jr.","Oklahoma","EDGE"],
  [372,"Reuben Fatheree II","Texas A&M","OT"],
  [373,"Donaven McCulley","Michigan","WR"],
  [374,"Jalon Daniels","Kansas","QB"],
  [375,"Cole Wisniewski","Texas Tech","S"],
  [376,"Khalil Dinkins","Penn State","TE"],
  [377,"Diego Pavia","Vanderbilt","QB"],
  [378,"David Blay Jr.","Miami (Fla.)","DT"],
  [379,"Drew Stevens","Iowa","K"],
  [380,"Sam Howard","Tulane","LB"],
  [381,"Tyre West","Tennessee","DT"],
  [382,"Miles Capers","Vanderbilt","EDGE"],
  [383,"Myles Rowser","Arizona St.","S"],
  [384,"Austin Brown","Wisconsin","S"],
  [385,"Ernest Hausmann","Michigan","LB"],
  [386,"Keeshawn Silver","USC","DT"],
  [387,"Tomas Rimac","Virginia Tech","IOL"],
  [388,"Terion Stewart","Virginia Tech","RB"],
  [389,"Nick DeGennaro","James Madison","WR"],
  [390,"Miles Scott","Illinois","S"],
  [391,"Isaiah Nwokobia","SMU","S"],
  [392,"Bryce Foster","Kansas","IOL"],
  [393,"Dean Connors","Houston","RB"],
  [394,"Zach Durfee","Washington","EDGE"],
  [395,"Shiyazh Pete","Kentucky","OT"],
  [396,"Keyshawn James-Newby","New Mexico","EDGE"],
  [397,"Christian Jones","San Diego St.","OT"],
  [398,"Dan Villari","Syracuse","TE"],
  [399,"Al'zillion Hamilton","Fresno St.","CB"],
  [400,"Caden Fordham","NC State","LB"],
  [401,"DQ Smith","South Carolina","S"],
  [402,"Kobe Baynes","Kansas","IOL"],
  [403,"James Neal III","Iowa St.","OT"],
  [404,"Ja'Mori Maclin","Kentucky","WR"],
  [405,"Vincent Anthony Jr.","Duke","EDGE"],
  [406,"Shad Banks Jr.","UTSA","LB"],
  [407,"Maximus Pulley","Wofford","S"],
  [408,"Cortez Braham Jr.","Memphis","WR"],
  [409,"Kentrel Bullock","South Alabama","RB"],
  [410,"Rod Moore","Michigan","S"],
  [411,"Jaylan Knighton","West Virginia","RB"],
  [412,"Tyreek Chappell","Texas A&M","CB"],
  [413,"Jake Pope","Illinois St.","OT"],
  [414,"Tony Grimes","Purdue","CB"],
  [415,"Hank Beatty","Illinois","WR"],
  [416,"Davon Booth","Miss. State","RB"],
  [417,"Cam Miller","Rutgers","CB"],
  [418,"Kolbey Taylor","Vanderbilt","CB"],
  [419,"Bryan Thomas Jr.","South Carolina","EDGE"],
  [420,"Carsen Ryan","BYU","TE"],
  [421,"Keelan Marion","Miami (Fla.)","WR"],
  [422,"Tyas Martin","Marshall","DT"],
  [423,"Jack Velling","Michigan St.","TE"],
  [424,"Terry Webb","SMU","DT"],
  [425,"Trent Hendrick","James Madison","LB"],
  [426,"Malik Spencer","Michigan St.","S"],
  [427,"Rushawn Lawrence","Minnesota","DT"],
  [428,"Jacob Thomas","James Madison","S"],
  [429,"Connor Tollison","Missouri","IOL"],
  [430,"Jalen Catalon","Missouri","S"],
  [431,"Isheem Young","Memphis","S"],
  [432,"Tyler Van Dyke","SMU","QB"],
  [433,"Zion Nelson","SMU","OT"],
  [434,"Alex Afari Jr.","Kentucky","LB"],
  [435,"Javon Gipson","Abil Christian","WR"],
  [436,"Derek Simmons","Oklahoma","OT"],
  [437,"Rocco Spindler","Nebraska","IOL"],
  [438,"James Faminu","UNLV","OT"],
  [439,"Jhalyn Shuler","South Florida","LB"],
  [440,"Michael Wortham","Montana","WR"],
  [441,"Anthony Smith","East Carolina","WR"],
  [442,"DJ Graham II","Kansas","CB"],
  [443,"Courtland Ford","UCLA","OT"],
  [444,"Pete Nygra","Louisville","IOL"],
  [445,"Brylan Green","Liberty","S"],
  [446,"Christian Martin","Colorado St.","OT"],
  [447,"Jack Dingle","Cincinnati","LB"],
  [448,"Amari Niblack","Texas A&M","TE"],
  [449,"Armani Winfield","Colorado St.","WR"],
  [450,"Bangally Kamara","Kansas","LB"],
  [451,"Bernard Gooden","LSU","DT"],
  [452,"Dayon Hayes","Texas A&M","EDGE"],
  [453,"EJ Smith","Texas A&M","RB"],
  [454,"Chris Hilton Jr.","LSU","WR"],
  [455,"Daniel Sobkowicz","Illinois St.","WR"],
  [456,"Declan Williams","Incarnate Word","LB"],
  [457,"Giovanni El-Hadi","Michigan","IOL"],
  [458,"Ismail Mahdi","Arizona","RB"],
  [459,"Joe Cooper","Slippery Rock","OT"],
  [460,"Jyrin Johnson","Bowling Green","TE"],
  [461,"Kris Hutson","Arizona","WR"],
  [462,"Kyron Drones","Virginia Tech","QB"],
  [463,"Maverick McIvor","W. Kentucky","QB"],
  [464,"Miller Moss","Louisville","QB"],
  [465,"Rayshon Luke","Fresno St.","RB"],
  [466,"West Weeks","LSU","LB"],
  [467,"Blake Shapen","Miss. State","QB"],
  [468,"Dekel Crowdus","Wisconsin","WR"],
  [469,"Matthew Henry","W. Kentucky","WR"],
  [470,"Preston Stone","Northwestern","QB"],
  [471,"Uar Bernard","Nigeria","DT"],
  [472,"Joshua Weru","Kenya","EDGE"],
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Convert expert rank (1-472) to initial Elo rating.
// Rank 1 → ~1860, Rank 472 → ~1360. Linear spread gives the simulation
// a meaningful starting point grounded in expert opinion.
function rankToRating(rank: number, total: number): number {
  return 1860 - ((rank - 1) / (total - 1)) * 500;
}

function eloExpected(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
function kFactor(comparisons: number): number {
  if (comparisons < 5)  return 24;
  if (comparisons < 15) return 20;
  if (comparisons < 40) return 16;
  return 12;
}
function opponentWeight(oppComps: number): number {
  return Math.min(1, 0.55 + 0.015 * oppComps);
}

async function main() {
  console.log(`Loading 2026 community rankings…`);

  const rows = await db.communityRanking.findMany({
    where: { draftYear: YEAR },
    include: { player: { select: { id: true, fullName: true, position: true } } },
  });

  if (rows.length === 0) {
    console.error("No CommunityRanking rows found. Run npm run db:seed first.");
    process.exit(1);
  }

  // Build slug → communityRanking row map.
  const bySlug = new Map(rows.map((r) => [slugify(r.player.fullName), r]));

  type State = {
    id: number;
    playerId: number;
    position: string;
    fullName: string;
    rating: number;
    sigma: number;
    comparisons: number;
  };

  // Step 1: Set initial ratings from the expert big board.
  console.log(`Seeding initial ratings from expert big board (${BIG_BOARD.length} players)…`);
  const total = BIG_BOARD.length;
  let matched = 0;
  let unmatched: string[] = [];

  const states = new Map<number, State>();

  // First, initialize all players from DB at their current rating.
  for (const r of rows) {
    states.set(r.playerId, {
      id: r.id,
      playerId: r.playerId,
      position: r.player.position,
      fullName: r.player.fullName,
      rating: r.rating,
      sigma: r.sigma,
      comparisons: r.comparisons,
    });
  }

  // Then override with expert rankings.
  for (const [rank, name] of BIG_BOARD) {
    const slug = slugify(name);
    const row = bySlug.get(slug);
    if (row) {
      const state = states.get(row.playerId);
      if (state) {
        state.rating = rankToRating(rank, total);
        state.sigma = 280; // reset uncertainty so the simulation has room to move
        state.comparisons = 0;
        matched++;
      }
    } else {
      unmatched.push(`#${rank} ${name}`);
    }
  }

  console.log(`  Matched: ${matched}/${total}`);
  if (unmatched.length > 0) {
    console.log(`  Unmatched (${unmatched.length}): ${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? " …" : ""}`);
  }

  // Step 2: Run Elo simulation.
  console.log(`\nRunning ${N_VOTES} simulated matchups…`);
  const players = Array.from(states.values());

  for (let i = 0; i < N_VOTES; i++) {
    // Pick highest-uncertainty player as anchor.
    players.sort((a, b) => b.sigma - a.sigma);
    const anchor = players[0];

    const crossPosOk = i > N_VOTES * 0.5;
    const candidates = players
      .filter((p) => p.playerId !== anchor.playerId)
      .filter((p) => crossPosOk || p.position === anchor.position)
      .map((p) => ({ p, dist: Math.abs(p.rating - anchor.rating) }))
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length === 0) continue;

    // Pick randomly from the 5 nearest opponents to add variety.
    const opponent = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))].p;

    const pureP = eloExpected(anchor.rating, opponent.rating);
    const noisedP = (1 - NOISE) * pureP + NOISE * 0.5;
    const anchorWins = Math.random() < noisedP;

    const winner = anchorWins ? anchor : opponent;
    const loser  = anchorWins ? opponent : anchor;

    const kW = kFactor(winner.comparisons) * opponentWeight(loser.comparisons);
    const kL = kFactor(loser.comparisons)  * opponentWeight(winner.comparisons);
    const expW = eloExpected(winner.rating, loser.rating);

    winner.rating      += kW * (1 - expW);
    winner.sigma        = Math.max(80, winner.sigma * 0.992);
    winner.comparisons += 1;

    loser.rating        = Math.max(1000, loser.rating + kL * (0 - (1 - expW)));
    loser.sigma         = Math.max(80, loser.sigma * 0.992);
    loser.comparisons  += 1;

    if ((i + 1) % 2000 === 0) {
      process.stdout.write(`  ${i + 1}/${N_VOTES}\r`);
    }
  }

  // Step 3: Write back to DB.
  console.log(`\nWriting ${players.length} ratings to DB…`);
  const BATCH = 50;
  for (let i = 0; i < players.length; i += BATCH) {
    await Promise.all(
      players.slice(i, i + BATCH).map((p) =>
        db.communityRanking.update({
          where: { id: p.id },
          data: { rating: p.rating, sigma: p.sigma, comparisons: p.comparisons },
        }),
      ),
    );
  }

  // Recompute overall + positional ranks.
  console.log("Recomputing rank positions…");
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const posCounters: Record<string, number> = {};
  await Promise.all(
    sorted.map((p, idx) => {
      posCounters[p.position] = (posCounters[p.position] ?? 0) + 1;
      return db.communityRanking.update({
        where: { id: p.id },
        data: { rankOverall: idx + 1, rankPos: posCounters[p.position] },
      });
    }),
  );

  console.log("\nTop 15 after seeding:");
  sorted.slice(0, 15).forEach((p, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${p.fullName.padEnd(28)} ${p.rating.toFixed(1).padStart(7)}  (${p.comparisons} comps)`),
  );
  console.log(`\nDone. Expert board applied + ${N_VOTES} simulated votes.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
