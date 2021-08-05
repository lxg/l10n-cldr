import * as fs from 'fs'
import { dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const basePath = fs.realpathSync(`${__dirname}/../..`)
const esmDataPath = `${basePath}/dist/esm/data`
 


export async function getLocaleData(locale) {
    let file
 
    try {        
        file = await import(pathToFileURL(`${esmDataPath}/${locale}.js`).href)
    } catch {
         try {
             file = await import(pathToFileURL(`${esmDataPath}/${locale.substr(0, 2)}.js`).href)
        } catch (e) {
            console.log(e);
            throw new Error(`No CLDR data found for ${locale}.`)
        }
    }
    
    return file
}
