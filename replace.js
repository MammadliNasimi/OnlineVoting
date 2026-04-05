const fs = require('fs');
let c = fs.readFileSync('src/controllers/vote.controller.js', 'utf8');
c = c.replace(/message: 'Oyunuz i[^']*?: ' \+ jobError\.message/, "message: 'Islem basarisiz. Zaten oy kullanmis olabilirsiniz.'");
c = c.replace(/message: 'You have already voted in this election\.'/, "message: 'Daha önce oy kullandiniz.'");
c = c.replace(/message: 'Smart contract rejected the vote: ' \+ \(error\.reason \|\| 'unknown reason'\)/, "message: 'Islem reddedildi. Zaten oy kullanmis olabilirsiniz.'");
c = c.replace(/message: error\.reason \|\| error\.message \|\| 'Vote submission failed'/, "message: 'Oy gönderimi basarisiz oldu. Islem daha önce yapilmis olabilir.'");
fs.writeFileSync('src/controllers/vote.controller.js', c);
