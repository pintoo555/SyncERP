/**
 * Indian states and union territories with major cities for HRMS dropdowns.
 */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
] as const;

export const INDIAN_STATE_CITIES: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Amaravati'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Namsai', 'Changlang', 'Tezu', 'Ziro', 'Tawang', 'Bomdila'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon', 'Dhubri', 'Diphu', 'North Lakhimpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Bihar Sharif', 'Katihar', 'Munger', 'Chhapra'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Sanquelim'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Nadiad', 'Morbi', 'Mehsana', 'Bhuj'],
  'Haryana': ['Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Palampur', 'Baddi', 'Nahan', 'Kullu', 'Manali', 'Chamba', 'Una', 'Hamirpur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Phusro', 'Medininagar'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Gulbarga', 'Davanagere', 'Bellary', 'Bijapur', 'Shimoga', 'Tumkur', 'Raichur', 'Bidar', 'Hospet'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Alappuzha', 'Palakkad', 'Malappuram', 'Kannur', 'Kasaragod', 'Kottayam', 'Pathanamthitta'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Navi Mumbai', 'Sangli', 'Malegaon', 'Jalgaon', 'Akola', 'Latur', 'Ahmednagar', 'Dhule', 'Ichalkaranji', 'Chandrapur', 'Parbhani', 'Jalna', 'Bhusawal', 'Panvel', 'Ulhasnagar', 'Mira-Bhayandar', 'Nanded', 'Satara'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul', 'Senapati', 'Tamenglong'],
  'Meghalaya': ['Shillong', 'Tura', 'Nongstoin', 'Jowai', 'Nongpoh', 'Williamnagar', 'Resubelpara', 'Mawkyrwat'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Saiha', 'Champhai', 'Kolasib', 'Serchhip', 'Mamit', 'Khawzawl', 'Saitual'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Phek', 'Mon', 'Kiphire', 'Longleng', 'Peren'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Bargarh', 'Jeypore', 'Bhawanipatna'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot', 'Hoshiarpur', 'Batala', 'Moga', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk', 'Kishangarh', 'Beawar', 'Hanumangarh', 'Gangapur City', 'Sawai Madhopur', 'Churu', 'Jhunjhunu', 'Chittorgarh'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Ravangla', 'Pelling', 'Rangpo', 'Jorethang'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Ranipet', 'Nagercoil', 'Thanjavur', 'Vellore', 'Kancheepuram', 'Erode'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Ambassa', 'Kailasahar', 'Belonia', 'Khowai', 'Teliamura', 'Bishalgarh'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Allahabad', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Pithoragarh', 'Ramnagar', 'Mussoorie', 'Nainital', 'Almora'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj'],
  'Andaman and Nicobar Islands': ['Port Blair', 'Diglipur', 'Rangat', 'Mayabunder', 'Car Nicobar', 'Nancowry', 'Little Andaman'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa', 'Naroli'],
  'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'Dwarka', 'Rohini', 'Saket', 'Karol Bagh'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur', 'Kupwara', 'Budgam', 'Kulgam', 'Pulwama'],
  'Ladakh': ['Leh', 'Kargil', 'Nubra', 'Zanskar', 'Drass', 'Diskit', 'Padum', 'Turtuk'],
  'Lakshadweep': ['Kavaratti', 'Agatti', 'Amini', 'Minicoy', 'Andrott', 'Kadmat', 'Kiltan', 'Chetlat', 'Bitra', 'Kalpeni'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe', 'Ozhukarai', 'Villianur', 'Uzhavarkarai'],
};

export const FAMILY_RELATIONS = ['Spouse', 'Daughter', 'Son', 'Mother', 'Father'] as const;
export const GENDER_OPTIONS = ['Male', 'Female'] as const;

export function getCitiesForState(state: string): string[] {
  if (!state || !state.trim()) return [];
  const cities = INDIAN_STATE_CITIES[state.trim()];
  return cities ? [...cities].sort() : [];
}
