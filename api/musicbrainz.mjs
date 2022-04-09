import axios from "axios";
import { escapeArtist, sleep } from "../utils/common.mjs";
import { parseArtistCredit } from "../utils/artists.mjs";
import dayjs from "dayjs";
import { parseCatalog } from "../utils/catalog.mjs";

const RelationTypes = {
    MemberOfGroup: "5be4c609-9afa-4ea0-910b-12ffb71e3821",
    VoiceActor: "e259a3f5-ce8e-45c1-9ef7-90ff7d0c7589",
};

class MusicBrainzApi {
    async getReleaseInfo(releaseId) {
        const API = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artist-credits+labels&fmt=json`;
        const albumData = await axios.get(API).then((res) => res.data);
        await sleep(1500);
        const title = albumData.title;
        // const catalog = albumData["label-info"]?.[0]?.["catalog-number"];
        // const parsedCatalog = parseCatalog(catalog);
        // console.log(parsedCatalog);
        const releaseDate = albumData.date;
        const albumArtistCredit = albumData["artist-credit"];
        const edition = albumData.disambiguation;
        console.log(`Title: ${title}, Release Date: ${releaseDate}`);
        const albumArtist = await parseArtistCredit(
            albumArtistCredit,
            releaseDate
        );
        const discs = albumData.media;
        const parsedDiscs = [];

        for (const disc of discs) {
            const tracks = disc.tracks;
            const parsedTracks = [];
            for (const track of tracks) {
                const trackTitle = track.title;
                const trackArtistCredit = track["artist-credit"];
                const trackRecodingArtistCredit =
                    track.recording?.["artist-credit"];
                const chosenArtistCredit =
                    trackArtistCredit.length >= trackRecodingArtistCredit.length
                        ? trackArtistCredit
                        : trackRecodingArtistCredit; // TODO: cover songs
                const artist = await parseArtistCredit(
                    chosenArtistCredit,
                    releaseDate
                );
                let type = "normal";
                if (
                    ["off vocal", "instrumental"].some((type) =>
                        trackTitle.toLowerCase().includes(type)
                    )
                ) {
                    type = "instrumental";
                } else if (
                    ["drama", "ドラマ"].some((type) =>
                        trackTitle.toLowerCase().includes(type)
                    ) ||
                    artist === "[dialogue]"
                ) {
                    type = "drama";
                }
                parsedTracks.push({
                    title: trackTitle,
                    artist:
                        artist === "[dialogue]"
                            ? escapeArtist(albumArtist)
                            : artist,
                    type,
                });
            }
            parsedDiscs.push({
                tracks: parsedTracks,
            });
        }
        return {
            title,
            // catalog,
            releaseDate,
            albumArtist,
            edition,
            discs: parsedDiscs,
        };
    }
    async getGroupMembers(groupId, date) {
        const API = `https://musicbrainz.org/ws/2/artist/${groupId}?fmt=json&inc=artist-rels`;
        const groupData = await axios.get(API).then((res) => res.data);
        await sleep(1500);
        const relations = groupData.relations || [];
        const memberRelations = relations
            .filter(
                (relation) =>
                    relation["type-id"] === RelationTypes.MemberOfGroup
            )
            .filter((relation) => {
                if (!date) {
                    return true;
                }
                const begin = dayjs(relation.begin);
                const end = dayjs(relation.end);
                const releaseDate = dayjs(date);
                if (begin.isValid() && end.isValid()) {
                    if (
                        begin.isBefore(releaseDate) &&
                        end.isAfter(releaseDate)
                    ) {
                        return true;
                    } else {
                        console.log(
                            `Ignoring ${
                                relation.artist.name
                            }, cause it's not in the group when release date is ${releaseDate.format(
                                "YYYY-MM-DD"
                            )}`
                        );
                        return false;
                    }
                } else if (begin.isValid()) {
                    if (begin.isBefore(releaseDate)) {
                        return true;
                    } else {
                        console.log(
                            `Ignoring ${
                                relation.artist.name
                            }, cause it's not in the group when release date is ${releaseDate.format(
                                "YYYY-MM-DD"
                            )}`
                        );
                        return false;
                    }
                } else {
                    return true;
                }
            });
        return memberRelations.map((relation) => ({
            id: relation.artist.id,
            name: relation.artist.name,
            type: relation.artist.type,
        }));
    }
    async getVoiceActorForCharacter(characterId) {
        const API = `https://musicbrainz.org/ws/2/artist/${characterId}?fmt=json&inc=artist-rels`;
        const groupData = await axios.get(API).then((res) => res.data);
        await sleep(1500);
        const relations = groupData.relations || [];
        const memberRelations = relations.filter(
            (relation) => relation["type-id"] === RelationTypes.VoiceActor
        );
        if (memberRelations.length === 0) {
            throw new Error(
                `No voice actor found for character ${characterId}`
            );
        }
        return {
            id: memberRelations[0].artist.id,
            name: memberRelations[0].artist.name,
        };
    }
    async getReleaseIdByCatalog(catalog) {
        const API = `https://musicbrainz.org/ws/2/release?query=catno:${catalog}&fmt=json`;
        const searchResult = await axios.get(API).then((res) => res.data);
        await sleep(1500);
        if (searchResult.count === 0) {
            throw new Error(`No release found for catalog ${catalog}`);
        }
        const bestMatchRelease = searchResult.releases[0];
        if (
            bestMatchRelease["label-info"]?.[0]?.["catalog-number"] !== catalog
        ) {
            throw new Error(`No release found for catalog ${catalog}`);
        }
        return { id: bestMatchRelease.id, title: bestMatchRelease.title };
    }
}

export default new MusicBrainzApi();
