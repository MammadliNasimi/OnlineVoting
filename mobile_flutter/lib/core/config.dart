const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://ssi-voting-backend.onrender.com',
);
const socketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: apiUrl);
const chainId = int.fromEnvironment('CHAIN_ID', defaultValue: 11155111);
const contractAddress = String.fromEnvironment(
  'CONTRACT_ADDRESS',
  defaultValue: '0x62a8878de43d5d6fd9B199d92556843a57F39aae',
);
