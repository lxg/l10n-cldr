#!/usr/bin/env node

import * as fs from 'fs'
import rimraf from 'rimraf'
import fg from "fast-glob"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

const basePath = fs.realpathSync(`${__dirname}/..`)
const nodePath = `${basePath}/node_modules`
const cjsCldrPath = `${basePath}/dist/cjs/cldr`
const esmCldrPath = `${basePath}/dist/esm/cldr`
const validLocale = /^[a-z]{2}(-[A-Z]{2})?$/

const cldrFirstDay = JSON.parse(fs.readFileSync(`${nodePath}/cldr-core/supplemental/weekData.json`))
    .supplemental.weekData.firstDay

// days in cldrFirstDay are mon,sun … we need numbers however
const firstDays = { sun: "0", mon: "1", fri: "5", sat: "6" }

const cldrDatePath = `${nodePath}/cldr-dates-modern/main`
const cldrNamesPath = `${nodePath}/cldr-localenames-full/main`


const cldrDateFiles = {}
fg.sync("**/ca-gregorian.json", { cwd: cldrDatePath }).forEach(file => {
    const locale = file.replace(/\/.*$/, "")
    if (locale.match(validLocale)) {
        cldrDateFiles[locale] = JSON.parse(fs.readFileSync(`${cldrDatePath}/${file}`).toString())
    }
})

const cldrCountryFiles = {}
fg.sync("**/territories.json", { cwd: cldrNamesPath }).forEach(file => {
    const locale = file.replace(/\/.*$/, "")

    if (locale.match(validLocale)) {
        const countryList = JSON.parse(fs.readFileSync(`${cldrNamesPath}/${file}`).toString())
            .main[locale].localeDisplayNames.territories

        cldrCountryFiles[locale] = {}

        // add only entries with an ALPHA-2 code
        Object.keys(countryList).forEach(code => {
            if (code.match(/^[A-Z]{2}$/) && code !== "ZZ") {
                cldrCountryFiles[locale][code] = countryList[code]
            }
        })
    }
})

;[cjsCldrPath, esmCldrPath].forEach(path => {
    fs.existsSync(path) || fs.mkdirSync(path, { recursive: true })
    fs.readdirSync(path).length && rimraf.sync(`${path}/*`)
})

Object.keys(cldrDateFiles).forEach(locale => {
    const country = locale.substr(3, 2)

    if (cldrCountryFiles[locale]) {
        const data = {
            days: cldrDateFiles[locale].main[locale].dates.calendars.gregorian.days["stand-alone"].wide,
            daysShort: cldrDateFiles[locale].main[locale].dates.calendars.gregorian.days["stand-alone"].abbreviated,
            months: cldrDateFiles[locale].main[locale].dates.calendars.gregorian.months["stand-alone"].wide,
            monthsShort: cldrDateFiles[locale].main[locale].dates.calendars.gregorian.months["stand-alone"].abbreviated,
            countries: cldrCountryFiles[locale]
        }

        fs.writeFileSync(
            `${esmCldrPath}/${locale}.mjs`,
            `export const countries = ${JSON.stringify(data.countries)}\n` +
            `export const months = ${JSON.stringify(Object.values(data.months))}\n` +
            `export const days = ${JSON.stringify(Object.values(data.days))}\n` +
            `export const daysShort = ${JSON.stringify(Object.values(data.daysShort))}\n` +
            `export const monthsShort = ${JSON.stringify(Object.values(data.monthsShort))}\n` +
            `export const firstday = ${firstDays[cldrFirstDay[country] || "mon"]}\n`
        )

        fs.writeFileSync(
            `${cjsCldrPath}/${locale}.cjs`,
            `exports.countries = ${JSON.stringify(data.countries)}\n` +
            `exports.months = ${JSON.stringify(Object.values(data.months))}\n` +
            `exports.days = ${JSON.stringify(Object.values(data.days))}\n` +
            `exports.daysShort = ${JSON.stringify(Object.values(data.daysShort))}\n` +
            `exports.monthsShort = ${JSON.stringify(Object.values(data.monthsShort))}\n` +
            `exports.firstday = ${firstDays[cldrFirstDay[country] || "mon"]}\n`
        )
    }
})
