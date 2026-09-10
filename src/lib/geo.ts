// Geolocation & Country Identification Utility for First-Party Analytics
// Provides 100% self-hosted, privacy-preserving country resolution with zero 3rd-party network calls.

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export interface GeoLocation {
  countryCode: string; // 2-letter ISO code e.g. "US", "CA", "GB"
  countryName: string; // Full name e.g. "United States", "Canada"
  countryFlag: string; // Emoji flag e.g. "🇺🇸", "🇨🇦"
}

// Comprehensive IANA Timezone to ISO 3166-1 alpha-2 mapping
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // United States
  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Kentucky/Louisville': 'US',
  'America/Kentucky/Monticello': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Indiana/Vincennes': 'US',
  'America/Indiana/Winamac': 'US',
  'America/Indiana/Marengo': 'US',
  'America/Indiana/Petersburg': 'US',
  'America/Indiana/Vevay': 'US',
  'America/Indiana/Tell_City': 'US',
  'America/Indiana/Knox': 'US',
  'America/Chicago': 'US',
  'America/Menominee': 'US',
  'America/North_Dakota/Center': 'US',
  'America/North_Dakota/New_Salem': 'US',
  'America/North_Dakota/Beulah': 'US',
  'America/Denver': 'US',
  'America/Boise': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Juneau': 'US',
  'America/Sitka': 'US',
  'America/Metlakatla': 'US',
  'America/Yakutat': 'US',
  'America/Nome': 'US',
  'America/Adak': 'US',
  'Pacific/Honolulu': 'US',

  // Canada
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Calgary': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Regina': 'CA',
  'America/Yellowknife': 'CA',
  'America/Whitehorse': 'CA',
  'America/Moncton': 'CA',
  'America/Glace_Bay': 'CA',
  'America/Goose_Bay': 'CA',
  'America/Iqaluit': 'CA',
  'America/Pangnirtung': 'CA',
  'America/Rankin_Inlet': 'CA',
  'America/Resolute': 'CA',
  'America/Inuvik': 'CA',
  'America/Cambridge_Bay': 'CA',
  'America/Dawson': 'CA',
  'America/Dawson_Creek': 'CA',
  'America/Fort_Nelson': 'CA',
  'America/Creston': 'CA',
  'America/Blanc-Sablon': 'CA',
  'America/Atikokan': 'CA',
  'America/Swift_Current': 'CA',
  'America/Nipigon': 'CA',
  'America/Rainy_River': 'CA',
  'America/Thunder_Bay': 'CA',

  // United Kingdom & Ireland
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Guernsey': 'GB',
  'Europe/Jersey': 'GB',
  'Europe/Isle_of_Man': 'GB',
  'Europe/Dublin': 'IE',

  // Australia & New Zealand
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
  'Australia/Canberra': 'AU',
  'Australia/Lord_Howe': 'AU',
  'Australia/Broken_Hill': 'AU',
  'Australia/Currie': 'AU',
  'Australia/Eucla': 'AU',
  'Australia/Lindeman': 'AU',
  'Pacific/Auckland': 'NZ',
  'Pacific/Chatham': 'NZ',

  // Western & Central Europe
  'Europe/Berlin': 'DE',
  'Europe/Busingen': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/San_Marino': 'SM',
  'Europe/Vatican': 'VA',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Africa/Ceuta': 'ES',
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Bratislava': 'SK',
  'Europe/Budapest': 'HU',
  'Europe/Athens': 'GR',
  'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG',
  'Europe/Zagreb': 'HR',
  'Europe/Belgrade': 'RS',
  'Europe/Ljubljana': 'SI',
  'Europe/Tallinn': 'EE',
  'Europe/Riga': 'LV',
  'Europe/Vilnius': 'LT',
  'Europe/Luxembourg': 'LU',
  'Europe/Malta': 'MT',
  'Europe/Monaco': 'MC',
  'Europe/Andorra': 'AD',
  'Atlantic/Reykjavik': 'IS',

  // Asia
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Singapore': 'SG',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Manila': 'PH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Jerusalem': 'IL',
  'Asia/Tel_Aviv': 'IL',
  'Asia/Istanbul': 'TR',
  'Europe/Istanbul': 'TR',

  // Latin America
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Monterrey': 'MX',
  'America/Mazatlan': 'MX',
  'America/Chihuahua': 'MX',
  'America/Hermosillo': 'MX',
  'America/Tijuana': 'MX',
  'America/Matamoros': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Rio_Branco': 'BR',
  'America/Manaus': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Bahia': 'BR',
  'America/Belem': 'BR',
  'America/Cuiaba': 'BR',
  'America/Campo_Grande': 'BR',
  'America/Porto_Velho': 'BR',
  'America/Boa_Vista': 'BR',
  'America/Buenos_Aires': 'AR',
  'America/Cordoba': 'AR',
  'America/Mendoza': 'AR',
  'America/Santiago': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',

  // Africa
  'Africa/Johannesburg': 'ZA',
  'Africa/Cairo': 'EG',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Casablanca': 'MA',
};

/**
 * Generate native Unicode regional indicator emoji flag for a 2-letter ISO country code.
 */
export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2 || code === 'UN' || code === 'XX') {
    return '🌐';
  }
  try {
    const upper = code.toUpperCase();
    return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
  } catch {
    return '🌐';
  }
}

/**
 * Resolves the official English country name for a 2-letter ISO code.
 */
export function getCountryName(code: string): string {
  if (!code || code === 'UN' || code === 'XX') {
    return 'Global / Direct';
  }
  try {
    return displayNames.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/**
 * Resolves visitor geographic location from request headers, client timezone, and browser locale.
 */
export function resolveGeoLocation(options: {
  headers?: Headers | Record<string, string | string[] | undefined> | null;
  timeZone?: string | null;
  language?: string | null;
}): GeoLocation {
  const { headers, timeZone, language } = options;

  let countryCode: string | null = null;

  // 1. Check standard CDN / Reverse Proxy Geolocation Headers
  if (headers) {
    const getHeader = (key: string): string | null => {
      if (typeof (headers as Headers).get === 'function') {
        return (headers as Headers).get(key);
      }
      const val = (headers as Record<string, any>)[key] || (headers as Record<string, any>)[key.toLowerCase()];
      return Array.isArray(val) ? val[0] : val || null;
    };

    const headerCandidates = [
      getHeader('cf-ipcountry'),
      getHeader('x-country-code'),
      getHeader('x-geo-country'),
      getHeader('x-vercel-ip-country'),
    ];

    for (const raw of headerCandidates) {
      if (raw && typeof raw === 'string') {
        const clean = raw.trim().toUpperCase();
        if (clean.length === 2 && clean !== 'XX' && clean !== 'T1') {
          countryCode = clean;
          break;
        }
      }
    }
  }

  // 2. Client IANA Timezone mapping
  if (!countryCode && timeZone && typeof timeZone === 'string') {
    const trimmedZone = timeZone.trim();
    if (TIMEZONE_TO_COUNTRY[trimmedZone]) {
      countryCode = TIMEZONE_TO_COUNTRY[trimmedZone];
    }
  }

  // 3. Client language tag fallback (e.g., "en-US" -> "US", "fr-CA" -> "CA", "de-DE" -> "DE")
  if (!countryCode && language && typeof language === 'string') {
    const parts = language.trim().split(/[-_]/);
    if (parts.length >= 2) {
      const candidate = parts[1].toUpperCase();
      if (candidate.length === 2 && /^[A-Z]{2}$/.test(candidate)) {
        countryCode = candidate;
      }
    }
  }

  const finalCode = countryCode || 'UN';
  return {
    countryCode: finalCode,
    countryName: getCountryName(finalCode),
    countryFlag: getCountryFlag(finalCode),
  };
}
