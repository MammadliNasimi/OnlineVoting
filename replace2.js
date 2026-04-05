const fs = require('fs');
let c = fs.readFileSync('src/controllers/vote.controller.js', 'utf8');
c = c.replace(/message: 'Daha .+nce oy kullandiniz\.'/g, "message: 'Daha önce oy kullandınız.'");
c = c.replace(/Oy g.+nderimi basarisiz oldu\. Islem daha .+nce yapilmis /g, "Oy gönderimi başarısız oldu. İşlem daha önce yapılmış ");
c = c.replace(/Islem basarisiz\. Zaten oy kullanmis/g, "İşlem başarısız. Zaten oy kullanmış");
c = c.replace(/Islem reddedildi\. Zaten oy kullanmis/g, "İşlem reddedildi. Zaten oy kullanmış");
fs.writeFileSync('src/controllers/vote.controller.js', c);
