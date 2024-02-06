// Your initial projects list
let projects = [
    "EdgeTX/edgetx",
    "ExpressLRS/ExpressLRS",
    "iNavFlight/inav",
    "betaflight/betaflight",
    "BossHobby/QUICKSILVER",
    "hd-zero/hdzero-goggle",
    "hd-zero/hdzero-vtx"
];

// Save projects to a cookie
function saveProjectsToCookie(projects) {
    try {
        document.cookie = `projects=${JSON.stringify(projects)}; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
    } catch (error) {
        console.error('Failed to stringify projects');
    }
}

// Load projects from a cookie
function loadProjectsFromCookie() {
    let cookies = document.cookie.split('; ');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].split('=');
        if (cookie[0] === 'projects') {
            try {
                return JSON.parse(cookie[1]);
            } catch (error) {
                // Delete the cookie
                document.cookie = "projects=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                console.error("Error parsing projects from cookie");
                break;
            }
        }
    }
    return [];
}

// Load projects from cookie
let savedProjects = loadProjectsFromCookie();
if (savedProjects.length > 0) {
    projects = savedProjects;
}

function fetchWithTimeout(url, options, timeout = 5000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Unable to get data')), timeout)
        )
    ]);
}

async function getReleaseInfo(project) {
    let url = "https://api.github.com/repos/" + project + "/releases";
    try {
        const cachedData = localStorage.getItem(`releaseInfo_${project}`);
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            if (parsedData.expiresAt > Date.now()) {
                console.log("Using cache");
                return parsedData.data; // Use cached data
            } else {
                // Cache expired, delete
                localStorage.removeItem(`releaseInfo_${project}`);
                console.log("Cache expired");
            }
        }

        const response = await fetchWithTimeout(url);
        const data = await response.json();

        let latestRelease, previousRelease;

        for (let i = 0; i < data.length; i++) {
            if (!data[i].tag_name.includes('nightly')) {
                if (!latestRelease) {
                    latestRelease = data[i];
                } else if (!previousRelease) {
                    previousRelease = data[i];
                    break;
                }
            }
        }

        let latestTag = latestRelease?.tag_name;
        let latestDate = new Date(latestRelease?.published_at);
        let previousTag = previousRelease?.tag_name;
        let previousDate = new Date(previousRelease?.published_at);
        let diff = (isNaN(latestDate.getTime()) || isNaN(previousDate.getTime())) ?
            0 : Math.floor((latestDate - previousDate) / (1000 * 60 * 60 * 24));

        //save to cache
        const info = [latestTag, latestDate, previousTag, diff];
        const expirationTime = Date.now() + 24 * 60 * 60 * 1000;
        const cachedData2 = {
            data: info, // fetched data
            expiresAt: expirationTime
        };
        localStorage.setItem(`releaseInfo_${project}`, JSON.stringify(cachedData2));
        return info;
    } catch (error) {
        console.error("Error:", error);
        return [];  // Return an empty array on error
    }
}

function createTableRow(project) {
    let tr = document.createElement("tr");
    let tdProject = document.createElement("td");
    tdProject.textContent = project;
    tr.appendChild(tdProject);
    let tdLatest = document.createElement("td");
    tdLatest.textContent = "loading...";
    tr.appendChild(tdLatest);
    let tdDate = document.createElement("td");
    tdDate.textContent = "loading...";
    tr.appendChild(tdDate);
    let tdPrevious = document.createElement("td");
    tdPrevious.textContent = "loading...";
    tr.appendChild(tdPrevious);
    let tdDiff = document.createElement("td");
    tdDiff.textContent = "loading...";
    tr.appendChild(tdDiff);
    let tdAction = document.createElement("td");
    let removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.className = "remove-button";
    removeButton.addEventListener("click", function () {
        projectBody.removeChild(tr);
        // remove cookies and truncate array
        projects.splice(projects.indexOf(project), 1);
        saveProjectsToCookie(projects);
    });
    tdAction.appendChild(removeButton);
    tr.appendChild(tdAction);

    getReleaseInfo(project)
        .then(info => {
            tdLatest.textContent = info[0];  // latest release No
            tdDate.textContent = info[1] ? new Date(info[1]).toLocaleDateString('en-CA') : "-";  // release date
            tdPrevious.textContent = info[2];  // previous release No
            tdDiff.textContent = info[3] != 0 ? info[3] + " days" : "-";  // diff in days
        })
        .catch(error => console.error(error));
    return tr;
}

let projectInput = document.getElementById("project-input");
let projectBody = document.getElementById("project-body");
let addButton = document.getElementById("add-button");

// Use your projects list
for (let project of projects) {
    let tr = createTableRow(project);
    projectBody.appendChild(tr);
}

function handleInput() {
    let project = projectInput.value;
    // check for alphanumeric or hyphen, slash, alphanumeric or hyphen
    let pattern = /^[a-zA-Z]+[a-zA-Z\d\-_]*\/[a-zA-Z]+[a-zA-Z\d\-_]*$/;

    if (project && pattern.test(project)) {
        projectBody.appendChild(createTableRow(project));
        projects.push(project);
        saveProjectsToCookie(projects);
        projectInput.value = "";
    } else {
        console.error("Invalid project name, it should be in the format 'project/repository'.");
    }
}

addButton.addEventListener("click", function () {
    handleInput();
});

projectInput.addEventListener("submit", function (event) {
    if (event.key === 'Enter' || event.code === 'Enter') {
        handleInput();
    }
});