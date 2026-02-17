-- Migration 049: Seed common countries with phone codes for international trade.
-- India already exists from migration 036. This adds remaining major countries.

SET NOCOUNT ON;

-- Helper: insert only if country code not already present
DECLARE @countries TABLE (Code NVARCHAR(2), Name NVARCHAR(200), Currency NVARCHAR(3), Symbol NVARCHAR(10), Phone NVARCHAR(10));

INSERT INTO @countries VALUES
('AF','Afghanistan','AFN',N'؋','+93'),
('AL','Albania','ALL',N'L','+355'),
('DZ','Algeria','DZD',N'د.ج','+213'),
('AR','Argentina','ARS',N'$','+54'),
('AU','Australia','AUD',N'$','+61'),
('AT','Austria','EUR',N'€','+43'),
('BH','Bahrain','BHD',N'.د.ب','+973'),
('BD','Bangladesh','BDT',N'৳','+880'),
('BE','Belgium','EUR',N'€','+32'),
('BR','Brazil','BRL',N'R$','+55'),
('BN','Brunei','BND',N'$','+673'),
('BG','Bulgaria','BGN',N'лв','+359'),
('KH','Cambodia','KHR',N'៛','+855'),
('CA','Canada','CAD',N'$','+1'),
('CL','Chile','CLP',N'$','+56'),
('CN','China','CNY',N'¥','+86'),
('CO','Colombia','COP',N'$','+57'),
('HR','Croatia','EUR',N'€','+385'),
('CZ','Czech Republic','CZK',N'Kč','+420'),
('DK','Denmark','DKK',N'kr','+45'),
('EG','Egypt','EGP',N'£','+20'),
('EE','Estonia','EUR',N'€','+372'),
('ET','Ethiopia','ETB',N'Br','+251'),
('FI','Finland','EUR',N'€','+358'),
('FR','France','EUR',N'€','+33'),
('DE','Germany','EUR',N'€','+49'),
('GH','Ghana','GHS',N'₵','+233'),
('GR','Greece','EUR',N'€','+30'),
('HK','Hong Kong','HKD',N'$','+852'),
('HU','Hungary','HUF',N'Ft','+36'),
('IS','Iceland','ISK',N'kr','+354'),
('ID','Indonesia','IDR',N'Rp','+62'),
('IR','Iran','IRR',N'﷼','+98'),
('IQ','Iraq','IQD',N'ع.د','+964'),
('IE','Ireland','EUR',N'€','+353'),
('IL','Israel','ILS',N'₪','+972'),
('IT','Italy','EUR',N'€','+39'),
('JP','Japan','JPY',N'¥','+81'),
('JO','Jordan','JOD',N'د.ا','+962'),
('KZ','Kazakhstan','KZT',N'₸','+7'),
('KE','Kenya','KES',N'KSh','+254'),
('KW','Kuwait','KWD',N'د.ك','+965'),
('LV','Latvia','EUR',N'€','+371'),
('LB','Lebanon','LBP',N'ل.ل','+961'),
('LT','Lithuania','EUR',N'€','+370'),
('LU','Luxembourg','EUR',N'€','+352'),
('MY','Malaysia','MYR',N'RM','+60'),
('MX','Mexico','MXN',N'$','+52'),
('MA','Morocco','MAD',N'د.م.','+212'),
('MM','Myanmar','MMK',N'K','+95'),
('NP','Nepal','NPR',N'₨','+977'),
('NL','Netherlands','EUR',N'€','+31'),
('NZ','New Zealand','NZD',N'$','+64'),
('NG','Nigeria','NGN',N'₦','+234'),
('NO','Norway','NOK',N'kr','+47'),
('OM','Oman','OMR',N'ر.ع.','+968'),
('PK','Pakistan','PKR',N'₨','+92'),
('PH','Philippines','PHP',N'₱','+63'),
('PL','Poland','PLN',N'zł','+48'),
('PT','Portugal','EUR',N'€','+351'),
('QA','Qatar','QAR',N'ر.ق','+974'),
('RO','Romania','RON',N'lei','+40'),
('RU','Russia','RUB',N'₽','+7'),
('SA','Saudi Arabia','SAR',N'ر.س','+966'),
('RS','Serbia','RSD',N'дин.','+381'),
('SG','Singapore','SGD',N'$','+65'),
('SK','Slovakia','EUR',N'€','+421'),
('SI','Slovenia','EUR',N'€','+386'),
('ZA','South Africa','ZAR',N'R','+27'),
('KR','South Korea','KRW',N'₩','+82'),
('ES','Spain','EUR',N'€','+34'),
('LK','Sri Lanka','LKR',N'₨','+94'),
('SE','Sweden','SEK',N'kr','+46'),
('CH','Switzerland','CHF',N'Fr','+41'),
('TW','Taiwan','TWD',N'$','+886'),
('TH','Thailand','THB',N'฿','+66'),
('TR','Turkey','TRY',N'₺','+90'),
('UA','Ukraine','UAH',N'₴','+380'),
('AE','UAE','AED',N'د.إ','+971'),
('GB','United Kingdom','GBP',N'£','+44'),
('US','United States','USD',N'$','+1'),
('VN','Vietnam','VND',N'₫','+84'),
('ZW','Zimbabwe','ZWL',N'$','+263');

INSERT INTO dbo.utbl_Country (CountryCode, CountryName, CurrencyCode, CurrencySymbol, PhoneCode)
SELECT c.Code, c.Name, c.Currency, c.Symbol, c.Phone
FROM @countries c
WHERE NOT EXISTS (SELECT 1 FROM dbo.utbl_Country WHERE CountryCode = c.Code);

DECLARE @cnt INT;
SELECT @cnt = COUNT(*) FROM dbo.utbl_Country;
PRINT 'Migration 049: Seeded countries. Total now: ' + CAST(@cnt AS VARCHAR(10));
GO
