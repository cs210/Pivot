// Housing types
export const HOUSING_TYPES = ["Undergraduate", "Graduate"];

// Undergraduate residence types
export const UNDERGRADUATE_RESIDENCE_TYPES = [
    "Residence Halls",
    "Row Houses",
    "Fraternities & Sororities",
    "Co-ops",
    "Apartments & Suites",
    "Ethnic Theme Houses",
    "Academic Theme Houses"
];

// Graduate residence types 
export const GRADUATE_RESIDENCE_TYPES = [
    "Single Graduate"
];

// Undergraduate residences by type
export const UNDERGRADUATE_RESIDENCES = {
    "Residence Halls": [
        "Adams", "Adelfa", "Alondra", "Arroyo", "Branner", "Burbank", "Cardenal",
        "Castaño", "Cedro", "Crothers", "Crothers Memorial", "Donner", 
        "EAST (Treat)", "Faisan", "Gavilan", "Junipero", "Kimball", "Lantana", "Larkin", 
        "Loro", "Meier", "Mirlo", "Murray", "Naranja", "Norcliffe",
        "Otero", "Paloma", "Rinconada", "Robinson", "Roble", "Sally Ride", 
        "Schiff", "Soto", "Toyon", "Twain", "West Lagunita", "Yost"
    ],
    "Row Houses": [
        "550 Lasuen", 
        "680 Lomita", 
        "BOB (Robert Moore South)",
        "Durand",
        "Grove",
        "Jerry",
        "Mars",
        "Narnia",
        "Neptune (650 Mayfield)",
        "Pluto",
        "Roth",
        "Storey",
        "Toussaint Louverture (610 Mayfield)",
        "Warehaus (620 Mayfield)",
        "Xanadu",
        "ZAP"
    ],
    "Fraternities & Sororities": [
        "aKDPhi/Chi Omega (1018 Campus Drive)",
        "Alpha Phi/Kappa Kappa Gamma (675 Lomita)",
        "Delta Delta Delta",
        "Kappa Alpha",
        "Kappa Alpha Theta",
        "Kappa Sigma",
        "Phi Kappa Psi",
        "Pi Beta Phi",
        "Sigma Nu",
        "Sigma Phi Epsilon"
    ],
    "Co-ops": [
        "576 Alvarado",
        "Columbae",
        "Enchanted Broccoli Forest (EBF)",
        "Hammarskjold",
        "Kairos",
        "Synergy",
        "Terra"
    ],
    "Apartments & Suites": [
        "Governor's Corner Suites",
        "EVGR-A Duan",
        "Mirrielees"
    ],
    "Ethnic Theme Houses": [
        "Casa Zapata",
        "Muwekma-Tah-Ruk",
        "Okada",
        "Ujamaa"
    ],
    "Academic Theme Houses": [
        "Burbank (ITALIC+Arts)",
        "Ng (Humanities)",
        "Potter (Explore Energy)",
        "Robert Moore North (The Well House)",
        "Trancos (Outdoor House)",
        "Otero (Public Service & Civic Engagement)"
    ]
};

// Graduate residences by type
export const GRADUATE_RESIDENCES = {
    "Single Graduate": [
        "Escondido South (Low-Rise)",
        "Escondido Village",
        "Escondido Village (Low-Rise)",
        "Escondido Village (High-Rise)",
        "EVGR",
        "Kennedy",
        "GSB (Jack McDonald Hall)",
        "GSB (Schwab Residential Center)",
        "Lyman",
        "Munger",
        "Rains"
    ]
};

// Undergraduate room types
export const UNDERGRADUATE_ROOM_TYPES = [
    "Single",
    "One Room Double",
    "Two Room Double",
    "One Room Triple",
    "Two Room Triple",
    "Three Room Triple",
    "One Room Quad",
    "Two Room Quad",
    "Three Room Quad",
    "Studio Double",
    "2-Bedroom Double",
    "2-Bedroom Triple",
    "3-Bedroom Triple",
    "3-Person Suite",
    "4-Person Suite",
    "6-Person Suite",
    "8-Person Suite"
];

// Graduate room types
export const GRADUATE_ROOM_TYPES = [
    "Standard Studio, 1 bath",
    "Premium Studio, 1 bath",
    "2 bedroom, 1 bath",
    "3 bedroom, 1 bath",
    "Junior 2 bedroom, 1 bath",
    "Junior 2 bedroom, 2 bath",
    "Premium 2 bedroom, 2 bath",
    "2 bedroom, 2 bath Single (private bedroom)",
    "2 bedroom, 2 bath Double (shared bedroom)",
    "Premium 4 bedroom, 4.5 bath",
    "4 bedroom, 2 bath"
];

// Define room types available for specific undergraduate houses
export const UNDERGRADUATE_ROOM_TYPES_BY_HOUSE = {
    // Branner
    "Branner": ["Single", "One Room Double", "Two Room Double", "One Room Triple", "Two Room Triple"],

    // Crothers
    "Crothers": ["Single", "One Room Double", "Two Room Triple"],
    "Crothers Memorial": ["Single", "One Room Double"],

    // Florence Moore
    "Alondra": ["Single", "One Room Double", "Two Room Triple"],
    "Cardenal": ["Single", "One Room Double", "Two Room Triple"],
    "Faisan": ["Single", "One Room Double", "Two Room Triple"],
    "Gavilan": ["Single", "One Room Double"],
    "Loro": ["Single", "One Room Double", "Two Room Triple"],
    "Mirlo": ["Single", "One Room Double"],
    "Paloma": ["Single", "One Room Double"],

    // Gerhard Casper Quad
    "Castaño": ["Single", "One Room Double", "Two Room Double", "One Room Triple", "Two Room Triple", "Three Room Quad"],
    "Kimball": ["Single", "One Room Double", "Two Room Double", "Two Room Triple", "Two Room Quad"],
    "Lantana": ["Single", "One Room Double", "Two Room Double"],
    "Ng": ["Single", "One Room Double"],

    // Governor's Corner
    "Adams": ["Single", "One Room Double", "Two Room Double", "Two Room Triple"],
    "EAST (Treat)": ["Single", "One Room Double", "Two Room Double", "Two Room Triple"],
    "Murray": ["Single", "One Room Double", "Two Room Double"],
    "Potter": ["Single", "One Room Double", "Two Room Double", "Two Room Triple"],
    "Robinson": ["Single", "One Room Double", "Two Room Double", "One Room Triple", "Three Room Quad"],
    "Schiff": ["Single", "One Room Double", "Two Room Double", "Two Room Triple", "Two Room Quad"],
    "Yost": ["Single", "One Room Double", "Two Room Double"],

    // Lagunita
    "Adelfa": ["Single", "One Room Double"],
    "Meier": ["Single", "One Room Double", "Two Room Double"],
    "Naranja": ["Single", "One Room Double"],
    "Norcliffe": ["Single", "One Room Double", "Two Room Double"],
    "Ujamaa": ["Single", "One Room Double", "One Room Triple"],
    "West Lagunita": ["Single", "One Room Double", "One Room Triple"],

    // Roble
    "Roble": ["Single", "One Room Double", "Two Room Double", "Two Room Triple", "Three Room Quad"],

    // Stern
    "Burbank": ["Single", "One Room Double"],
    "Casa Zapata": ["Single", "One Room Double"],
    "Donner": ["Single", "One Room Double"],
    "Larkin": ["Single", "One Room Double"],
    "Sally Ride": ["Single", "One Room Double"],
    "Twain": ["Single", "One Room Double"],

    // Toyon
    "Toyon": ["Single", "One Room Double", "Two Room Double", "Two Room Triple", "Three Room Quad"],

    // Wilbur
    "Arroyo": ["Single", "One Room Double"],
    "Cedro": ["Single", "One Room Double"],
    "Junipero": ["Single", "One Room Double"],
    "Okada": ["Single", "One Room Double"],
    "Otero": ["Single", "One Room Double"],
    "Rinconada": ["Single", "One Room Double"],
    "Soto": ["Single", "One Room Double"],
    "Trancos": ["Single", "One Room Double"]
};

// For the residence types
export const UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE = {
    "Row Houses": [
        "Single",
        "One Room Double",
        "Two Room Double",
        "One Room Triple",
        "Two Room Triple",
        "One Room Quad",
        "Two Room Quad"
    ],
    "Fraternities & Sororities": [
        "Single",
        "One Room Double",
        "Two Room Double",
        "One Room Triple",
        "Two Room Triple",
        "One Room Quad"
    ],
    "Co-ops": [
        "Single",
        "One Room Double",
        "Two Room Double",
        "One Room Triple"
    ],
    "Apartments & Suites": [
        "Studio Double",
        "2-Bedroom Double",
        "2-Bedroom Triple",
        "3-Bedroom Triple",
        "3-Person Suite",
        "4-Person Suite",
        "6-Person Suite",
        "8-Person Suite"
    ],
    "Ethnic Theme Houses": [
        "Single",
        "One Room Double",
        "Two Room Double",
        "One Room Triple"
    ],
    "Academic Theme Houses": [
        "Single",
        "One Room Double",
        "Two Room Double",
        "One Room Triple"
    ]
};

// Define room types available for each graduate residence
export const GRADUATE_ROOM_TYPES_BY_RESIDENCE = {
    "Escondido South (Low-Rise)": [
        "2 bedroom, 1 bath",
        "3 bedroom, 1 bath"
    ],
    "Escondido Village": [
        "Standard Studio, 1 bath"
    ],
    "Escondido Village (Low-Rise)": [
        "2 bedroom, 1 bath",
        "3 bedroom, 1 bath"
    ],
    "Escondido Village (High-Rise)": [
        "Junior 2 bedroom, 1 bath"
    ],
    "EVGR": [
        "Premium Studio, 1 bath",
        "Premium 2 bedroom, 2 bath",
        "Junior 2 bedroom, 2 bath",
        "2 bedroom, 2 bath Single (private bedroom)",
        "2 bedroom, 2 bath Double (shared bedroom)"
    ],
    "Kennedy": [
        "Premium Studio, 1 bath",
        "Premium 2 bedroom, 2 bath",
        "Junior 2 bedroom, 2 bath"
    ],
    "GSB (Jack McDonald Hall)": [
        "2 bedroom, 2 bath"
    ],
    "GSB (Schwab Residential Center)": [
        "2 bedroom, 2 bath"
    ],
    "Lyman": [
        "2 bedroom, 1 bath"
    ],
    "Munger": [
        "Premium Studio, 1 bath",
        "Standard Studio, 1 bath",
        "Premium 2 bedroom, 2 bath",
        "Premium 4 bedroom, 4.5 bath"
    ],
    "Rains": [
        "2 bedroom, 1 bath",
        "4 bedroom, 2 bath"
    ]
};