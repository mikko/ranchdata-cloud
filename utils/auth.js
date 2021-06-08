const rawENV = process.env.API_TOKENS

function parseTokenENV() {
    const APITokens = rawENV.split("#").reduce((tokens, item) => {
        [mode, token, userID] = item.split(":");
        return Object.assign(tokens, {[token]: {mode, userID}});
    }, {})
    return APITokens;
}

const APITokens = parseTokenENV();

function getUser(token, mode) {
    const user = APITokens[token];
    if (user === undefined || user.mode !== mode) {
        return null;
    }
    return user.userID;
}

function parseTokenHeader(event) {
    const authHeader = event.headers.Authorization;
    const [type, token] = authHeader.split(" "); // Bearer abc-123
    return token;
}

function getWriteAuthorizedUser(event) {
    const token = parseTokenHeader(event);
    const user = getUser(token, 'W');
    return user;
}

function getReadAuthorizedUser(event) {
    const token = parseTokenHeader(event);
    const user = getUser(token, 'R');
    return user;
}

module.exports = {
    getWriteAuthorizedUser,
    getReadAuthorizedUser
}
