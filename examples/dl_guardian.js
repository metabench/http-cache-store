


const BackEnd = require('../BackEnd')

const url_guardian_main = 'https://www.theguardian.com/uk';
const dbPath = './guardian.sqlite';

(async() => {
    const backend = new BackEnd({
        dbPath
    });
    
    await backend.start();

    console.log('Backend started.');


    



})();