export interface AfricanCountry {
  code: string;
  name: string;
  flag: string;
  region: 'North' | 'West' | 'East' | 'Central' | 'South';
  dialCode: string;
  languages: string[];
}

export const africanCountries: AfricanCountry[] = [
  // North Africa
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿', region: 'North', dialCode: '+213', languages: ['Arabe', 'Tamazight'] },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬', region: 'North', dialCode: '+20', languages: ['Arabe'] },
  { code: 'LY', name: 'Libye', flag: '🇱🇾', region: 'North', dialCode: '+218', languages: ['Arabe'] },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦', region: 'North', dialCode: '+212', languages: ['Arabe', 'Tamazight', 'Français'] },
  { code: 'MR', name: 'Mauritanie', flag: '🇲🇷', region: 'North', dialCode: '+222', languages: ['Arabe', 'Français'] },
  { code: 'SD', name: 'Soudan', flag: '🇸🇩', region: 'North', dialCode: '+249', languages: ['Arabe'] },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳', region: 'North', dialCode: '+216', languages: ['Arabe', 'Français'] },
  // West Africa
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', region: 'West', dialCode: '+229', languages: ['Français'] },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', region: 'West', dialCode: '+226', languages: ['Français'] },
  { code: 'CV', name: 'Cap-Vert', flag: '🇨🇻', region: 'West', dialCode: '+238', languages: ['Portugais'] },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', region: 'West', dialCode: '+225', languages: ['Français'] },
  { code: 'GM', name: 'Gambie', flag: '🇬🇲', region: 'West', dialCode: '+220', languages: ['Anglais'] },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', region: 'West', dialCode: '+233', languages: ['Anglais'] },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳', region: 'West', dialCode: '+224', languages: ['Français'] },
  { code: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', region: 'West', dialCode: '+245', languages: ['Portugais'] },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', region: 'West', dialCode: '+231', languages: ['Anglais'] },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', region: 'West', dialCode: '+223', languages: ['Français'] },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', region: 'West', dialCode: '+227', languages: ['Français'] },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', region: 'West', dialCode: '+234', languages: ['Anglais'] },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', region: 'West', dialCode: '+221', languages: ['Français'] },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', region: 'West', dialCode: '+232', languages: ['Anglais'] },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', region: 'West', dialCode: '+228', languages: ['Français'] },
  // East Africa
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', region: 'East', dialCode: '+257', languages: ['Français', 'Kirundi'] },
  { code: 'KM', name: 'Comores', flag: '🇰🇲', region: 'East', dialCode: '+269', languages: ['Arabe', 'Français', 'Comorien'] },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', region: 'East', dialCode: '+253', languages: ['Arabe', 'Français'] },
  { code: 'ER', name: 'Érythrée', flag: '🇪🇷', region: 'East', dialCode: '+291', languages: ['Tigrigna', 'Arabe'] },
  { code: 'ET', name: 'Éthiopie', flag: '🇪🇹', region: 'East', dialCode: '+251', languages: ['Amharique'] },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', region: 'East', dialCode: '+254', languages: ['Swahili', 'Anglais'] },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', region: 'East', dialCode: '+261', languages: ['Malgache', 'Français'] },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', region: 'East', dialCode: '+265', languages: ['Chichewa', 'Anglais'] },
  { code: 'MU', name: 'Maurice', flag: '🇲🇺', region: 'East', dialCode: '+230', languages: ['Anglais', 'Français', 'Créole'] },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', region: 'East', dialCode: '+258', languages: ['Portugais'] },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', region: 'East', dialCode: '+250', languages: ['Kinyarwanda', 'Français', 'Anglais'] },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', region: 'East', dialCode: '+248', languages: ['Créole', 'Anglais', 'Français'] },
  { code: 'SO', name: 'Somalie', flag: '🇸🇴', region: 'East', dialCode: '+252', languages: ['Somali', 'Arabe'] },
  { code: 'SS', name: 'Soudan du Sud', flag: '🇸🇸', region: 'East', dialCode: '+211', languages: ['Anglais'] },
  { code: 'TZ', name: 'Tanzanie', flag: '🇹🇿', region: 'East', dialCode: '+255', languages: ['Swahili', 'Anglais'] },
  { code: 'UG', name: 'Ouganda', flag: '🇺🇬', region: 'East', dialCode: '+256', languages: ['Anglais', 'Swahili'] },
  { code: 'ZM', name: 'Zambie', flag: '🇿🇲', region: 'East', dialCode: '+260', languages: ['Anglais'] },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', region: 'East', dialCode: '+263', languages: ['Anglais', 'Shona', 'Ndebele'] },
  // Central Africa
  { code: 'AO', name: 'Angola', flag: '🇦🇴', region: 'Central', dialCode: '+244', languages: ['Portugais'] },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', region: 'Central', dialCode: '+237', languages: ['Français', 'Anglais'] },
  { code: 'CF', name: 'Centrafrique', flag: '🇨🇫', region: 'Central', dialCode: '+236', languages: ['Français', 'Sango'] },
  { code: 'TD', name: 'Tchad', flag: '🇹🇩', region: 'Central', dialCode: '+235', languages: ['Arabe', 'Français'] },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', region: 'Central', dialCode: '+242', languages: ['Français'] },
  { code: 'CD', name: 'RD Congo', flag: '🇨🇩', region: 'Central', dialCode: '+243', languages: ['Français'] },
  { code: 'GQ', name: 'Guinée équatoriale', flag: '🇬🇶', region: 'Central', dialCode: '+240', languages: ['Espagnol', 'Français', 'Portugais'] },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', region: 'Central', dialCode: '+241', languages: ['Français'] },
  { code: 'ST', name: 'São Tomé-et-Príncipe', flag: '🇸🇹', region: 'Central', dialCode: '+239', languages: ['Portugais'] },
  // Southern Africa
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', region: 'South', dialCode: '+267', languages: ['Anglais', 'Setswana'] },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', region: 'South', dialCode: '+268', languages: ['Swati', 'Anglais'] },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', region: 'South', dialCode: '+266', languages: ['Sesotho', 'Anglais'] },
  { code: 'NA', name: 'Namibie', flag: '🇳🇦', region: 'South', dialCode: '+264', languages: ['Anglais'] },
  { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', region: 'South', dialCode: '+27', languages: ['Zoulou', 'Xhosa', 'Afrikaans', 'Anglais'] },
];

export const regionNames: Record<AfricanCountry['region'], string> = {
  North: '🌍 Afrique du Nord',
  West: '🌍 Afrique de l\'Ouest',
  East: '🌍 Afrique de l\'Est',
  Central: '🌍 Afrique Centrale',
  South: '🌍 Afrique Australe',
};

export const getCountryByCode = (code: string) =>
  africanCountries.find(c => c.code === code);

export const getCountriesByRegion = () => {
  const regions: Record<string, AfricanCountry[]> = {};
  africanCountries.forEach(country => {
    if (!regions[country.region]) regions[country.region] = [];
    regions[country.region].push(country);
  });
  return regions;
};
