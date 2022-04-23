import MusicBrainz from "../api/musicbrainz.mjs";
import { escapeArtist } from "./common.mjs";
const characterPersonMap = new Map();
const groupMemberCache = new Map();

export const parseArtistCredit = async (artistCredits, releaseDate) => {
    const parsedArtists = Array.from(artistCredits, (item) => {
        return {
            name: item.artist.name,
            type: item.artist.type,
            id: item.artist.id,
        };
    });
    const groups = parsedArtists.filter((artist) => artist.type === "Group");
    const persons = parsedArtists.filter((artist) => artist.type === "Person");
    const characters = parsedArtists.filter(
        (artist) => artist.type === "Character"
    );
    let result = [];
    for (const artist of parsedArtists) {
        if (artist.type === "Group") {
            result.push({
                id: artist.id,
                name: escapeArtist(artist.name),
                children: [],
            });
        } else if (artist.type === "Character") {
            const charaIndex = characters.findIndex(
                (chara) => chara.name === artist.name
            );
            const correspondingPerson = persons[charaIndex];
            let correspondingPersonName;
            // Missing corresponding person, guess from other tracks
            if (characterPersonMap.has(artist.name)) {
                correspondingPersonName = characterPersonMap.get(artist.name);
            } else if (correspondingPerson) {
                correspondingPersonName = correspondingPerson.name;
                characterPersonMap.set(artist.name, correspondingPersonName);
            } else {
                console.log(
                    `Missing corresponding person for ${artist.name}, getting from MusicBrainz...`
                );
                const person = await MusicBrainz.getVoiceActorForCharacter(
                    artist.id
                );
                if (person) {
                    console.log(
                        `Got corresponding person for ${artist.name}: ${person.name}`
                    );
                    correspondingPersonName = person.name;
                    characterPersonMap.set(
                        artist.name,
                        correspondingPersonName
                    );
                } else {
                    console.log(`No corresponding person for ${artist.name}`);
                }
            }
            const pushTarget = result[result.length - 1]?.children
                ? result[result.length - 1].children
                : result;
            if (correspondingPersonName) {
                pushTarget.push({
                    id: artist.id,
                    name: `${escapeArtist(artist.name)}（${escapeArtist(
                        correspondingPersonName
                    )}）`,
                });
            } else {
                pushTarget.push({
                    id: artist.id,
                    name: `${escapeArtist(artist.name)}`,
                });
            }

            if (persons[charaIndex]) {
                persons[charaIndex].used = true;
            }
        } else if (artist.type === "Person" && !artist.used) {
            result[result.length - 1]?.children
                ? result[result.length - 1].children.push({
                      id: artist.id,
                      name: escapeArtist(artist.name),
                  })
                : result.push({
                      id: artist.id,
                      name: escapeArtist(artist.name),
                  });
        } else if (artist.type === "Other") {
            result[result.length - 1]?.children
                ? result[result.length - 1].children.push({
                      id: artist.id,
                      name: escapeArtist(artist.name),
                  })
                : result.push({
                      id: artist.id,
                      name: escapeArtist(artist.name),
                  });
        }
    }
    const noMemberGroups = result.filter((i) => i.children?.length === 0);
    if (noMemberGroups.length > 0) {
        for (const group of noMemberGroups) {
            if (groupMemberCache.has(group.name)) {
                group.children = groupMemberCache.get(group.name);
            } else {
                console.log(
                    `Missing members for group: ${group.name}, getting from MusicBrainz...`
                );
                const members = await MusicBrainz.getGroupMembers(
                    group.id,
                    releaseDate
                );
                console.log(
                    `Got members for group: ${group.name}: ${members
                        .map((member) => member.name)
                        .join(", ")}`
                );
                const characterMembers = members.filter(
                    (member) => member.type === "Character"
                );
                if (characterMembers.length > 0) {
                    for (const character of characterMembers) {
                        if (characterPersonMap.has(character.name)) {
                            character.name = `${escapeArtist(
                                character.name
                            )}（${escapeArtist(
                                characterPersonMap.get(character.name)
                            )}）`;
                        } else {
                            console.log(
                                `Missing corresponding person for ${character.name}, getting from MusicBrainz...`
                            );
                            const person =
                                await MusicBrainz.getVoiceActorForCharacter(
                                    character.id
                                );
                            if (person) {
                                console.log(
                                    `Got corresponding person for ${character.name}: ${person.name}`
                                );
                                characterPersonMap.set(
                                    character.name,
                                    person.name
                                );
                                character.name = `${escapeArtist(
                                    character.name
                                )}（${escapeArtist(person.name)}）`;
                            } else {
                                console.log(
                                    `No corresponding person for ${character.name}`
                                );
                            }
                        }
                    }
                }
                groupMemberCache.set(group.name, members);
                group.children = members;
            }

            group.children = group.children.map((member) => ({
                id: member.id,
                name: member.name,
            }));
        }
    }
    return result
        .map((i) => {
            if (i.children?.length) {
                return `${i.name}（${i.children
                    .map((c) => c.name)
                    .join("、")}）`;
            } else {
                return i.name;
            }
        })
        .join("、");
};
