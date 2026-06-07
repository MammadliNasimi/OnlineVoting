const ethers = require('ethers');

const localKey = '0xb7cee478320dd457d416cbb9644822dd2893627e08906739ad0183834d446a6e';
const wallet = new ethers.Wallet(localKey);
const contractIssuer = '0x80EB754C33e220e8bB0A9cdEC8A2740C1fd1BEE0';

console.log('Local ADMIN_PRIVATE_KEY Wallet Address:', wallet.address);
console.log('Contract Issuer Address (local demo):  ', contractIssuer);

if (wallet.address.toLowerCase() === contractIssuer.toLowerCase()) {
  console.log('\n✅ ADDRESSES MATCH!');
} else {
  console.log('\n❌ ADDRESSES DO NOT MATCH!');
  console.log('   Contract expects:', contractIssuer.toLowerCase());
  console.log('   Local key gives:', wallet.address.toLowerCase());
}
