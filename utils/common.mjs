export const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

export const escapeFilename = (filename) => {
    let escapedFilename = filename;
    const maps = {
        "*": "＊",
        ":": "：",
        "<": "＜",
        ">": "＞",
        "?": "？",
    };
    for (const key of Object.keys(maps)) {
        escapedFilename = filename.replace(new RegExp(`\\${key}`, "g"), maps[key]);
    }
    return escapedFilename;
};

export const escapeArtist = (artist) => {
    return artist.replaceAll("、", "、、");
};
