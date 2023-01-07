const request = require("request");
const cheerio = require("cheerio");
const fs = require("fs");
const { resolve } = require("path");

const baseUrl = "https://meritsmmc.moh.gov.my/search/registeredDoctor?page=";

async function getPractitionerDetails(id) {
  return new Promise((resolve, reject) => {
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
        resolve(practitionerInformation);
      } else {
        reject(error);
      }
    });
  });
}

function getPageData(url) {
  return new Promise((resolve, reject) => {
    request(url, (error, response, html) => {
      if (error) {
        reject(error);
      } else if (response.statusCode !== 200) {
        reject(new Error(`Unsuccessful status code: ${response.statusCode}`));
      } else {
        try {
          const $ = cheerio.load(html);
          const practitioners = [];

          const practitionerNames = $("td:nth-of-type(2)");
          const practitionerPromises = []; // array to hold the promises for fetching practitioner information
          practitionerNames.each(async (i, element) => {
            const name = $(element).text();
            const graduatedFrom = $(element).next().text();
            const onclickAttr = $(element)
              .next()
              .next()
              .find("a")
              .attr("onclick");
            const url = onclickAttr.match(/'(.*?)'/)[1];
            const id = url.match(/\/(\d+)\//)[1];
            const practitioner = { name, graduated_from: graduatedFrom };
            // get practitioner information and add the returned promise to the array
            practitionerPromises.push(
              getPractitionerDetails(id).then((info) => {
                practitioner.practitioner_information = info;
                return practitioner;
              })
            );
          });

          // resolve the getPageData promise once all practitioner information has been fetched
          Promise.all(practitionerPromises).then((resolvedPractitioners) => {
            resolve(resolvedPractitioners);
          });
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

async function scrapeData(minPage, maxPage) {
  const pagePromises = []; // array to hold the promises for scraping each page
  for (let i = minPage; i <= maxPage; i++) {
    const url = `${baseUrl}${i}`;
    // get data for each page and add the returned promise to the array
    pagePromises.push(getPageData(url));
  }

  // wait for all pages to be scraped
  let data = await Promise.all(pagePromises);

  const currentDate = new Date();
  const fileName = `scraped-doctors-${currentDate.toISOString()}.json`;
  fs.writeFile(fileName, JSON.stringify(data), (err) => {
    if (err) throw err;
    console.log(`Data saved to ${fileName}`);
  });

  // flatten the array of arrays into a single array
  data = data.flat();
  return data;
}

scrapeData();

// open an express server

const express = require("express");

const app = express();

// route handler for /api/doctors
app.get("/api/doctors", async (req, res) => {
  const min = req.query.min;
  const max = req.query.max;
  try {
    const data = await scrapeData(min, max);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// start the server on port 6969
app.listen(6969, () => {
  console.log("Server listening on port 6969");
});
