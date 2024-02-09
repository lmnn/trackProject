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

// Save projects to localStorage
function saveProjectsToLocalStorage(projects) {
    try {
        localStorage.setItem('projects', JSON.stringify(projects));
    } catch (error) {
        console.error('Failed to stringify projects');
    }
}

function updateRateLimitDiv(remainingLimit = "-", totalLimit = 60, resetTime = "-") {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in UTC epoch (seconds)
    const timeDiffInMinutes = isNaN(resetTime) ? resetTime : Math.ceil(Math.abs(resetTime - currentTime) / 60);

    const rateLimitMessage = `Rate limit: ${remainingLimit}/${totalLimit}`;
    const rateResetMessage = `Limit reset in ${timeDiffInMinutes} mins`;
    const nodeAPIInfo = `Github API requests are limited.`;

    const rateLimitDiv = document.getElementById('rate-limit');
    rateLimitDiv.innerHTML = `
      ${nodeAPIInfo}<br>
      ${rateLimitMessage}<br>
      ${rateResetMessage}`;
}

// Load projects from localStorage
function loadProjectsFromLocalStorage() {
    const savedProjects = localStorage.getItem('projects');
    updateRateLimitDiv();
    if (savedProjects) {
        try {
            return JSON.parse(savedProjects);
        } catch (error) {
            // Clear the localStorage
            localStorage.removeItem('projects');
            console.error("Error parsing projects from localStorage");
        }
    }
    return [];
}

// Load projects from localStorage
let savedProjects = loadProjectsFromLocalStorage();
if (savedProjects.length > 0) {
    projects = savedProjects;
}

function fetchWithTimeout(url, options, timeout = 10000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Unable to get data')), timeout)
        )
    ]);
}

async function getReleaseInfo(project) {
    const url = "https://api.github.com/repos/" + project + "/releases";
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

        if (!response.ok) {
            console.log('Project not found');
            return;
        }

        // Log Github API rate limits
        updateRateLimitDiv(
            response.headers.get('X-Ratelimit-Remaining'),
            response.headers.get('X-Ratelimit-Limit'),
            response.headers.get('X-RateLimit-Reset'));

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

        const latestTag = latestRelease?.tag_name;
        const tempDate = new Date(latestRelease?.published_at);
        const latestDate = isNaN(tempDate.getTime()) ? null : tempDate;
        const previousTag = previousRelease?.tag_name;
        const tempDate2 = new Date(previousRelease?.published_at);
        const previousDate = isNaN(tempDate2.getTime()) ? null : tempDate2;
        const diff = latestDate && previousDate ?
            Math.floor((latestDate - previousDate) / (1000 * 60 * 60 * 24)) : null;

        // Save to cache
        const info = [latestTag, latestDate, previousTag, diff];
        const expirationTime = Date.now() + 24 * 60 * 60 * 1000; //+1 day
        const cachedData2 = {
            data: info, // fetched data
            expiresAt: expirationTime
        };
        localStorage.setItem(`releaseInfo_${project}`, JSON.stringify(cachedData2));
        return info;
    } catch (error) {
        console.error("Error", error);
        return;
    }
}

function createTableRow(project) {
    const tr = document.createElement("tr");
    const tdProject = document.createElement("td");
    tdProject.textContent = project.replace("/", "/\u200B");
    tr.appendChild(tdProject);
    const tdLatest = document.createElement("td");
    tdLatest.textContent = "loading...";
    tr.appendChild(tdLatest);
    const tdDate = document.createElement("td");
    tdDate.textContent = "loading...";
    tr.appendChild(tdDate);
    const tdPrevious = document.createElement("td");
    tdPrevious.textContent = "loading...";
    tr.appendChild(tdPrevious);
    const tdDiff = document.createElement("td");
    tdDiff.textContent = "loading...";
    tr.appendChild(tdDiff);
    const tdAction = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.textContent = " X ";
    removeButton.className = "remove-button";
    removeButton.addEventListener("click", function () {
        projectBody.removeChild(tr);
        // remove from cache
        projects.splice(projects.indexOf(project), 1);
        saveProjectsToLocalStorage(projects);
        localStorage.removeItem(`releaseInfo_${project}`);
    });
    tdAction.appendChild(removeButton);
    tr.appendChild(tdAction);

    getReleaseInfo(project)
        .then(info => {
            if (!info) {
                console.log("DEBUG ", project)
                projects.splice(projects.indexOf(project), 1);
                saveProjectsToLocalStorage(projects);
                localStorage.removeItem(`releaseInfo_${project}`);
                projectBody.removeChild(tr);
                return;
            } else {
                tdLatest.textContent = info[0] ? info[0] : "-";                               // latest Release
                tdDate.textContent = info[1] ? new Date(info[1]).toLocaleDateString() : "-";  // release Date
                tdPrevious.textContent = info[2] ? info[2] : "-";                             // previous Release
                tdDiff.textContent = info[3] ? info[3] + " days" : "-";                       // Delta in days
            }
        })
        .catch(error => console.error(error));
    return tr;
}

const projectInput = document.getElementById("project-input");
const projectBody = document.getElementById("project-body");
const addButton = document.getElementById("add-button");

// Use your projects list
for (const project of projects) {
    const tr = createTableRow(project);
    if (tr) {
        projectBody.appendChild(tr);
    }
}

function parseRepoName(input) {
    let repoName;
    if (input.startsWith('http')) {
        const urlObj = new URL(input);
        const pathSegments = urlObj.pathname.split('/');
        repoName = pathSegments[1] + '/' + pathSegments[2];
    } else {
        repoName = input;
    }
    return repoName;
}

function removeInvisibleChars(str) {
    // This regular expression matches any character that is not a visible ASCII character.
    let regex = /[^\x20-\x7E]+/g;
    return str.replace(regex, '');
}

function handleInput() {
    const repoName = projectInput.value.trim();
    // Check for url
    const project = parseRepoName(removeInvisibleChars(repoName));

    // Check for alphanumeric or hyphen, slash, alphanumeric or hyphen
    const pattern = /^[a-zA-Z]+[a-zA-Z\d\-_]*\/[a-zA-Z]+[a-zA-Z\d\-_]*$/;

    if (project && pattern.test(project)) {
        const tr = createTableRow(project);
        if (tr) {
            projectBody.appendChild(tr);
            projects.push(project);
            saveProjectsToLocalStorage(projects);
            projectInput.value = "";
        } else {
            return;
        }
    } else {
        console.error("Invalid project name, it should be in the format 'project/repository'.");
    }
}

addButton.addEventListener("click", function () {
    handleInput();
});

projectInput.addEventListener("keypress", function (event) {
    if (event.key === 'Enter' || event.code === 'Enter') {
        handleInput();
    }
});

function sortRowsByName(rows, ascending) {
    return rows.sort(function (rowA, rowB) {
        const tdProjectA = rowA.getElementsByTagName("td")[0].textContent;
        const tdProjectB = rowB.getElementsByTagName("td")[0].textContent;
        return ascending ? tdProjectA.localeCompare(tdProjectB) : tdProjectB.localeCompare(tdProjectA);
    });
}

function sortRowsByDate(rows, ascending) {
    return rows.sort(function (rowA, rowB) {
        const dateA = new Date(rowA.getElementsByTagName("td")[2].textContent);
        const dateB = new Date(rowB.getElementsByTagName("td")[2].textContent);
        return ascending ? dateA - dateB : dateB - dateA;
    });
}

// Get the table and the headers
const table = document.getElementById("project-table");
const projectName = document.getElementById("project-name");
const projectDate = document.getElementById("project-date");
let sortOrder = false;

// Sort by name after clicking "Project" header
projectName.addEventListener("click", function () {
    // Get the rows in the table
    const rows = Array.from(table.getElementsByTagName("tr")).slice(1);  // slice(1) to exclude the header row

    const sortedRows = sortRowsByName(rows, sortOrder);

    // Remove the existing rows in the table
    for (let i = table.rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }

    // Append the sorted rows to the table
    const tbody = table.getElementsByTagName("tbody")[0];
    for (const row of sortedRows) {
        tbody.appendChild(row);
    }

    // Toggle sorting
    sortOrder = !sortOrder;
});

// Sort by date after clicking "Date" header
projectDate.addEventListener("click", function () {
    // Get the rows in the table
    const rows = Array.from(table.getElementsByTagName("tr")).slice(1);  // slice(1) to exclude the header row

    const sortedRows = sortRowsByDate(rows, sortOrder);

    // Remove the existing rows in the table
    for (let i = table.rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }

    // Append the sorted rows to the table
    const tbody = table.getElementsByTagName("tbody")[0];
    for (const row of sortedRows) {
        tbody.appendChild(row);
    }

    // Highlight cells in green where the date is no older than 1 month
    // and in red if older than half a year
    const today = new Date();
    const oneMonthAgo = new Date();
    const halfYearAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    halfYearAgo.setMonth(today.getMonth() - 6);
    for (const row of rows) {
        const dateCell = row.getElementsByTagName("td")[2];
        const date = new Date(dateCell.textContent);
        
        if (date > oneMonthAgo) {
            dateCell.style.backgroundColor = "#00BB0033";

            console.log("Debug colors:");
            console.log(" today:", today);
            console.log(" 1m ago:", oneMonthAgo);
            console.log(" 1/2y ago:", halfYearAgo);
            console.log("cell val:", dateCell.textContent);
            console.log("cell Date:", date);
            console.log(" date > oneMonthAgo:", Boolean(date > oneMonthAgo));
            console.log(" date < halfYearAgo", Boolean(date < halfYearAgo));
            console.log("");
        }
        if (date < halfYearAgo) {
            dateCell.style.backgroundColor = "#BB000033";

            console.log("Debug colors:");
            console.log(" today:", today);
            console.log(" 1m ago:", oneMonthAgo);
            console.log(" 1/2y ago:", halfYearAgo);
            console.log("cell val:", dateCell.textContent);
            console.log("cell Date:", date);
            console.log(" date > oneMonthAgo:", Boolean(date > oneMonthAgo));
            console.log(" date < halfYearAgo", Boolean(date < halfYearAgo));
            console.log("");
        }
    }
    
    // Toggle sorting
    sortOrder = !sortOrder;
});
