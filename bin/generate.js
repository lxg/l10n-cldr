#!/usr/bin/env node

import * as fs from 'fs'
import rimraf from 'rimraf'
import fg from "fast-glob"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

const basePath = fs.realpathSync(`${__dirname}/..`)
const nodePath = `${basePath}/node_modules`
const cldrSupplPath = `${nodePath}/cldr-core/supplemental`
const cldrDatePath = `${nodePath}/cldr-dates-modern/main`
const cldrNamesPath = `${nodePath}/cldr-localenames-full/main`
const cjsDataPath = `${basePath}/dist/cjs/data`
const esmDataPath = `${basePath}/dist/esm/data`
const validLocale = /^[a-z]{2}(-[A-Z]{2})?$/

const getSupplemental = (key) => {
    return JSON.parse(fs.readFileSync(`${cldrSupplPath}/${key}.json`)).supplemental[key]
}

// first days by country, and mapping of day codes to indexes
const cldrFirstDay = getSupplemental("weekData").firstDay
const firstDays = { sun: 0, mon: 1, fri: 5, sat: 6 }

const codeMappings = getSupplemental("codeMappings")

const cldrDateFiles = {}
fg.sync("**/ca-gregorian.json", { cwd: cldrDatePath }).forEach(file => {
    const locale = file.replace(/\/.*$/, "")
    if (locale.match(validLocale)) {
        cldrDateFiles[locale] = JSON.parse(fs.readFileSync(`${cldrDatePath}/${file}`).toString())
    }
})

const cldrCountries = {}
const cldrCountries3 = {}

fg.sync("**/territories.json", { cwd: cldrNamesPath }).forEach(file => {
    const locale = file.replace(/\/.*$/, "")

    if (locale.match(validLocale)) {
        const countryList = JSON.parse(fs.readFileSync(`${cldrNamesPath}/${file}`).toString())
            .main[locale].localeDisplayNames.territories

        cldrCountries[locale] = {}
        cldrCountries3[locale] = {}

        // add only entries with an ALPHA-2 code
        Object.keys(countryList).forEach(code => {
            const alpha3 = codeMappings[code]?._alpha3
            if (alpha3 && code.match(/^[A-Z]{2}$/) && code !== "ZZ" && code !== "EU" && code !== "EZ" && !code.startsWith("X")) {

                cldrCountries[locale][code] = countryList[code]
                cldrCountries3[locale][alpha3] = countryList[code]
            }
        })
    }
})

;[cjsDataPath, esmDataPath].forEach(path => {
    fs.existsSync(path) || fs.mkdirSync(path, { recursive: true })
    fs.readdirSync(path).length && rimraf.sync(`${path}/*`)
})

Object.keys(cldrDateFiles).forEach(locale => {
    const country = locale.substr(3, 2)

    if (cldrCountries[locale]) {
        const data = {
            countries: cldrCountries[locale],
            countries3: cldrCountries3[locale],
            days: Object.values(cldrDateFiles[locale].main[locale].dates.calendars.gregorian.days["stand-alone"].wide),
            daysShort: Object.values(cldrDateFiles[locale].main[locale].dates.calendars.gregorian.days["stand-alone"].abbreviated),
            months: Object.values(cldrDateFiles[locale].main[locale].dates.calendars.gregorian.months["stand-alone"].wide),
            monthsShort: Object.values(cldrDateFiles[locale].main[locale].dates.calendars.gregorian.months["stand-alone"].abbreviated),
            firstday : firstDays[cldrFirstDay[country] || "mon"]
        }

        const exports = {
            "export const " : `${esmDataPath}/${locale}.js`,
            "exports." : `${cjsDataPath}/${locale}.cjs`
        }

        Object.keys(exports).forEach(prefix => {
            fs.writeFileSync(
                exports[prefix],
                Object.keys(data).map(key => `${prefix}${key} = ${JSON.stringify(data[key], null, 2)}`).join("\n\n")
            )
        })
    }
})

// supplemental (not country specific)

const telephoneCodeData = JSON.parse(fs.readFileSync(`${basePath}/data/telephoneCodeData.json`).toString())
    .supplemental.telephoneCodeData

const phoneData = {}

Object.keys(telephoneCodeData)
    .filter(code => code.match(/^[A-Z]{2}$/))
    .forEach(code => phoneData[code] = telephoneCodeData[code][0].telephoneCountryCode)

fs.writeFileSync(
    `${esmDataPath}/_common.js`,
    `export const phonePrefixes = ${JSON.stringify(phoneData)}\n`
)

fs.writeFileSync(
    `${cjsDataPath}/_common.cjs`,
    `exports.phonePrefixes = ${JSON.stringify(phoneData)}\n`
)
