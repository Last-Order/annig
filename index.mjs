#!/usr/bin/env node
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import erii from "erii";
import { fileURLToPath } from "url";
import MusicBrainz from "./api/musicbrainz.mjs";
import { escapeFilename, escapeTrackName } from "./utils/common.mjs";
import { parseCatalog } from "./utils/catalog.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (!process.env.ANNI_REPO) {
    throw new Error("Please set ANNI_REPO environment variable.");
}
const Erii = erii.default;
Erii.setMetaInfo({
    version: JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "./package.json")).toString()
    )["version"],
    name: "ANNIG / Anni Repo TOML Generator",
});

Erii.bind(
    {
        name: ["get", "g"],
        description: "Generate TOML file from MusicBrainz.",
        argument: {
            name: "mbid",
            description: "MBID",
        },
    },
    async (ctx, options) => {
        // Test Cases
        // 7b0912db-ae87-4f52-8500-93ba85bb83a4 - Multi Discs, Track Artists with CV
        // 37b084d2-6b57-4601-9069-287e2318751c - Single Disc, Track Artists without CV
        let releaseId = ctx.getArgument().toString();
        const directoryName = path.basename(path.resolve("./"));
        const matchResult = directoryName.match(
            /^\[(?<Year>\d{4}|\d{2})-?(?<Month>\d{2})-?(?<Day>\d{2})]\[(?<Catalog>[^\]]+)] (.+?)(?: \[(\d+) Discs])?$/
        );
        const catalogFromDirectoryName = matchResult?.groups?.Catalog;
        if (
            (catalogFromDirectoryName || options.catalog) &&
            releaseId === "true"
        ) {
            console.log(
                `Search from MusicBrainz for catalog: ${
                    options.catalog || catalogFromDirectoryName
                }...`
            );
            const { id: resultId, title: resultTitle } =
                await MusicBrainz.getReleaseIdByCatalog(
                    options.catalog || catalogFromDirectoryName
                );
            console.log(`Got release id: ${resultId}, title: ${resultTitle}`);
            releaseId = resultId;
        }
        if (!releaseId) {
            throw new Error(
                "Please execute this command in the album directories or provide mbid."
            );
        }
        console.log("Getting release info from MusicBrainz...");
        const { title, releaseDate, albumArtist, edition, discs, catalog } =
            await MusicBrainz.getReleaseInfo(releaseId);
        const catalogForUse = catalog || catalogFromDirectoryName;
        const parsedCatalog = parseCatalog(catalogForUse);
        const result = `[album]
album_id = "${crypto.randomUUID()}"
title = "${escapeFilename(title)}"
artist = "${albumArtist}"
date = ${releaseDate}
type = "normal"${edition ? `\nedition = "${edition}"` : ""}
catalog = "${catalogForUse}"
tags = []

${discs
    .map(
        (disc, index) => `[[discs]]
catalog = "${parsedCatalog[index]}"

${disc.tracks
    .map(
        (track) => `[[discs.tracks]]
title = "${escapeFilename(track.title)}"${
            track.artist !== albumArtist ? `\nartist = "${track.artist}"` : ""
        }${track.type !== "normal" ? `\ntype = "${track.type}"` : ""}
`
    )
    .join("\n")}`
    )
    .join("\n")}`;
        if (options.dryRun) {
            console.log(result);
            return;
        }
        const outputPath = path.resolve(
            process.env.ANNI_REPO,
            `./album/${catalogForUse}.toml`
        );
        fs.writeFileSync(outputPath, result);
        console.log(`TOML file generated at ${outputPath}`);
    }
);

Erii.addOption({
    name: ["catalog", "c"],
    command: "get",
    description: "Search by catalog",
});

Erii.addOption({
    name: ["dry-run"],
    command: "get",
    description: "Print result only",
});

Erii.default(() => {
    Erii.showHelp();
});

Erii.okite();
