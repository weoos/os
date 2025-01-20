/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-25 21:24:50
 * @Description: Coding something
 */
// user/repo[/filepath]
export function parseGithubFile (v: string, dfFile = '') {

    if (v.split('/').length === 2) {
        v += `/${dfFile}`;
    }

    return `https://cdn.jsdelivr.net/gh/${v}`;
}

// pkg_name[/filepath]
export function parseNPMFile (v: string, useUnpkg = false) {
    const base = useUnpkg ? 'unpkg.com' : 'cdn.jsdelivr.net/npm';
    return `https://${base}/${v}`;
}