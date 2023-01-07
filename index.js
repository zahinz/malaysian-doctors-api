const request = require("request");
const cheerio = require("cheerio");
const fs = require("fs");

const baseUrl = "https://meritsmmc.moh.gov.my/search/registeredDoctor?page=";

const maxPage = 2;
const data = [];

for (let i = 1; i <= maxPage; i++) {
  const url = `${baseUrl}${i}`;
  request(url, (error, response, html) => {
    if (!error && response.statusCode == 200) {
      const $ = cheerio.load(html);

      const practitionerNames = $("td:nth-of-type(2)");
      practitionerNames.each((i, element) => {
        const name = $(element).text();
        const graduatedFrom = $(element).next().text();
        const onclickAttr = $(element).next().next().find("a").attr("onclick");
        const url = onclickAttr.match(/'(.*?)'/)[1];
        const id = url.match(/\/(\d+)\//)[1];
        const practitioner = { name, graduated_from: graduatedFrom };

        const detailsUrl = `https://meritsmmc.moh.gov.my/viewDoctor/${id}/search`;
        request(detailsUrl, (error, response, html) => {
          if (!error && response.statusCode == 200) {
            const $ = cheerio.load(html);

            const qualification = $("#div-qualification")
              .children("div")
              .text()
              .trim();
            const provisionalRegistrationNumber = $(
              "#div-provisional-registration-number"
            )
              .children("div")
              .text()
              .trim();
            const dateOfProvisionalRegistration = $(
              "#div-date-of-provisional-registration"
            )
              .children("div")
              .text()
              .trim();
            const fullRegistrationNumber = $("#div-full-registration-number")
              .children("div")
              .text()
              .trim();
            const dateOfFullRegistration = $("#div-date-of-full-registration")
              .children("div")
              .text()
              .trim();

            const practitionerInformation = {
              qualification,
              provisionalRegistrationNumber,
              dateOfProvisionalRegistration,
              fullRegistrationNumber,
              dateOfFullRegistration,
            };
            practitioner.practitioner_information = practitionerInformation;
            console.log(practitioner);
          }
        });
      });

      if (i === maxPage) {
        const currentDate = new Date();
        const fileName = `scraped-doctors-${currentDate.toISOString()}.json`;
        fs.writeFile(fileName, JSON.stringify(data), (err) => {
          if (err) throw err;
          console.log(`Data saved to ${fileName}`);
        });
      }
    }
  });
}
