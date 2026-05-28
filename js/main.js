const width = 1000;
const height = 560;

const svg = d3.select("#map")
    .attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = d3.select("#tooltip");

const projection = d3.geoNaturalEarth1()
    .scale(170)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const radiusScale = d3.scaleSqrt()
    .domain([5.5, 9.5])
    .range([2, 14]);

const colorScale = d3.scaleLinear()
    .domain([0, 70, 300, 700])
    .range(["#e60000", "#ff7f00", "#ffd166", "#fff3b0"]);

let allEarthquakes = [];

Promise.all([
    d3.json("data/countries-110m.json"),
    d3.csv("data/earthquake.csv")
]).then(([worldData, earthquakeData]) => {

    const countries = topojson.feature(worldData, worldData.objects.countries);

    drawMap(countries);
    prepareData(earthquakeData);
    populateYearFilter();
    drawYearLineChart();
    updateVisualization();

}).catch(error => {
    console.error("Greška pri učitavanju podataka:", error);
});

function drawMap(countries) {
    svg.append("g")
        .selectAll("path")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path);
}

function prepareData(data) {
    allEarthquakes = data
        .filter(d => d.type === "earthquake")
        .filter(d =>
            d.time &&
            d.latitude !== "" &&
            d.longitude !== "" &&
            d.depth !== "" &&
            d.mag !== ""
        )
        .map(d => {
            const date = new Date(d.time);

            return {
                time: d.time,
                date: date,
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                day: date.getDate(),
                latitude: +d.latitude,
                longitude: +d.longitude,
                depth: +d.depth,
                mag: +d.mag,
                place: d.place,
                type: d.type
            };
        });

    console.log("Učitani i očišćeni potresi:", allEarthquakes);
    document.getElementById("total-earthquakes").textContent = allEarthquakes.length;
}

function populateYearFilter() {
    const years = Array.from(new Set(allEarthquakes.map(d => d.year))).sort();

    const yearFilter = d3.select("#year-filter");

    yearFilter.selectAll("option.year-option")
        .data(years)
        .enter()
        .append("option")
        .attr("class", "year-option")
        .attr("value", d => d)
        .text(d => d);
}


function getDepthCategory(depth) {
    if (depth < 70) {
        return "shallow";
    } else if (depth < 300) {
        return "medium";
    } else {
        return "deep";
    }
}


function getFilteredData() {
    const selectedYear = document.getElementById("year-filter").value;
    const selectedMagnitude = +document.getElementById("magnitude-filter").value;
    const selectedDepth = document.getElementById("depth-filter").value;

    return allEarthquakes.filter(d => {
        const yearMatch = selectedYear === "all" || d.year === +selectedYear;
        const magnitudeMatch = d.mag >= selectedMagnitude;
        const depthMatch = selectedDepth === "all" || getDepthCategory(d.depth) === selectedDepth;

        return yearMatch && magnitudeMatch && depthMatch;
    });
}

function updateVisualization() {
    const filteredData = getFilteredData();

    document.getElementById("filtered-earthquakes").textContent = filteredData.length;

    const circles = svg.selectAll("circle.earthquake")
        .data(filteredData, d => d.time + d.place);

    circles.exit()
        .transition()
        .duration(500)
        .attr("r", 0)
        .remove();

    circles.enter()
        .append("circle")
        .attr("class", "earthquake")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 0)
        .attr("fill", d => colorScale(d.depth))
        .on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .transition()
        .duration(700)
        .attr("r", d => radiusScale(d.mag));

    circles.transition()
        .duration(700)
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => radiusScale(d.mag))
        .attr("fill", d => colorScale(d.depth));


    drawMagnitudeBarChart(filteredData);
    drawDepthScatterChart(filteredData);
    drawStrongestEarthquakes(filteredData);

    console.log("Trenutno prikazani potresi:", filteredData.length);
}

function showTooltip(event, d) {
    tooltip
        .style("display", "block")
        .html(`
            <strong>${d.place}</strong><br>
            Datum: ${d.date.toLocaleDateString("hr-HR")}<br>
            Magnituda: ${d.mag}<br>
            Dubina: ${d.depth} km
        `);
}

function moveTooltip(event) {
    tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
}

function hideTooltip() {
    tooltip.style("display", "none");
}

document.getElementById("year-filter").addEventListener("change", updateVisualization);
document.getElementById("magnitude-filter").addEventListener("change", updateVisualization);
document.getElementById("depth-filter").addEventListener("change", updateVisualization);

document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("year-filter").value = "all";
    document.getElementById("magnitude-filter").value = "5.5";
    document.getElementById("depth-filter").value = "all";
    updateVisualization();
});



function drawYearLineChart() {
    const chartWidth = 650;
    const chartHeight = 320;

    const margin = {
        top: 20,
        right: 25,
        bottom: 45,
        left: 60
    };

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    const chartSvg = d3.select("#year-line-chart")
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

    chartSvg.selectAll("*").remove();

    const earthquakesByYear = d3.rollups(
        allEarthquakes,
        v => v.length,
        d => d.year
    )
        .map(([year, count]) => ({
            year: +year,
            count: count
        }))
        .sort((a, b) => d3.ascending(a.year, b.year));

    const xScale = d3.scaleLinear()
        .domain(d3.extent(earthquakesByYear, d => d.year))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(earthquakesByYear, d => d.count)])
        .nice()
        .range([innerHeight, 0]);

    const chartGroup = chartSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format("d"))
        .ticks(8);

    const yAxis = d3.axisLeft(yScale)
        .ticks(6);

    chartGroup.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    chartGroup.append("g")
        .attr("class", "axis")
        .call(yAxis);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.count))
        .curve(d3.curveMonotoneX);

    chartGroup.append("path")
        .datum(earthquakesByYear)
        .attr("class", "line-chart-line")
        .attr("d", line);

    chartGroup.selectAll("circle")
        .data(earthquakesByYear)
        .enter()
        .append("circle")
        .attr("class", "line-chart-dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.count))
        .attr("r", 4)
        .on("mouseover", function (event, d) {
            tooltip
                .style("display", "block")
                .html(`
                    <strong>Godina: ${d.year}</strong><br>
                    Broj potresa: ${d.count}
                `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .on("click", function (event, d) {
            document.getElementById("year-filter").value = d.year;
            updateVisualization();
        });

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight - 5)
        .attr("text-anchor", "middle")
        .text("Godina");

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .text("Broj potresa");
}


function getMagnitudeCategory(mag) {
    if (mag < 6.0) {
        return "5.5-5.9";
    } else if (mag < 6.5) {
        return "6.0-6.4";
    } else if (mag < 7.0) {
        return "6.5-6.9";
    } else {
        return "7.0+";
    }
}

function drawMagnitudeBarChart(data) {
    const chartWidth = 520;
    const chartHeight = 320;

    const margin = {
        top: 20,
        right: 20,
        bottom: 45,
        left: 55
    };

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    const chartSvg = d3.select("#magnitude-bar-chart")
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

    chartSvg.selectAll("*").remove();

    const categories = ["5.5-5.9", "6.0-6.4", "6.5-6.9", "7.0+"];

    const counts = categories.map(category => ({
        category: category,
        count: data.filter(d => getMagnitudeCategory(d.mag) === category).length
    }));

    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.25);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(counts, d => d.count) || 1])
        .nice()
        .range([innerHeight, 0]);

    const chartGroup = chartSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale);

    const yAxis = d3.axisLeft(yScale)
        .ticks(5);

    chartGroup.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    chartGroup.append("g")
        .attr("class", "axis")
        .call(yAxis);

    const bars = chartGroup.selectAll("rect")
        .data(counts, d => d.category);

    bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.category))
        .attr("y", innerHeight)
        .attr("width", xScale.bandwidth())
        .attr("height", 0)
        .on("mouseover", function (event, d) {
            tooltip
                .style("display", "block")
                .html(`
                    <strong>Magnituda: ${d.category}</strong><br>
                    Broj potresa: ${d.count}
                `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .transition()
        .duration(700)
        .attr("y", d => yScale(d.count))
        .attr("height", d => innerHeight - yScale(d.count));

    chartGroup.selectAll(".bar-label")
        .data(counts)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.count) - 6)
        .text(d => d.count > 0 ? d.count : "");

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight - 5)
        .attr("text-anchor", "middle")
        .text("Raspon magnitude");

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .text("Broj potresa");
}


function drawDepthScatterChart(data) {
    const chartWidth = 1000;
    const chartHeight = 340;

    const margin = {
        top: 25,
        right: 35,
        bottom: 55,
        left: 70
    };

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    const chartSvg = d3.select("#depth-scatter-chart")
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

    chartSvg.selectAll("*").remove();

    const xScale = d3.scaleLinear()
        .domain([5.5, d3.max(data, d => d.mag) || 9.5])
        .nice()
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.depth) || 700])
        .nice()
        .range([innerHeight, 0]);

    const chartGroup = chartSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale)
        .ticks(8);

    const yAxis = d3.axisLeft(yScale)
        .ticks(6);

    chartGroup.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    chartGroup.append("g")
        .attr("class", "axis")
        .call(yAxis);

    chartGroup.selectAll("circle")
        .data(data, d => d.time + d.place)
        .enter()
        .append("circle")
        .attr("class", "scatter-dot")
        .attr("cx", d => xScale(d.mag))
        .attr("cy", d => yScale(d.depth))
        .attr("r", 3)
        .attr("fill", d => colorScale(d.depth))
        .on("mouseover", function (event, d) {
            tooltip
                .style("display", "block")
                .html(`
                    <strong>${d.place}</strong><br>
                    Datum: ${d.date.toLocaleDateString("hr-HR")}<br>
                    Magnituda: ${d.mag}<br>
                    Dubina: ${d.depth} km
                `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight - 8)
        .attr("text-anchor", "middle")
        .text("Magnituda");

    chartSvg.append("text")
        .attr("class", "chart-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .text("Dubina potresa (km)");
}


function drawStrongestEarthquakes(data) {
    const listContainer = d3.select("#strongest-earthquakes-list");

    listContainer.selectAll("*").remove();

    const strongestEarthquakes = [...data]
        .sort((a, b) => d3.descending(a.mag, b.mag))
        .slice(0, 10);

    if (strongestEarthquakes.length === 0) {
        listContainer
            .append("p")
            .text("Nema potresa za odabrane filtere.");
        return;
    }

    const list = listContainer
        .append("div")
        .attr("class", "strongest-list");

    const items = list.selectAll(".strongest-item")
        .data(strongestEarthquakes)
        .enter()
        .append("div")
        .attr("class", "strongest-item");

    items.append("div")
        .attr("class", "strongest-rank")
        .text((d, i) => `${i + 1}.`);

    const info = items.append("div")
        .attr("class", "strongest-info");

    info.append("strong")
        .text(d => d.place);

    info.append("span")
        .text(d => `${d.date.toLocaleDateString("hr-HR")} | Dubina: ${d.depth} km`);

    items.append("div")
        .attr("class", "strongest-mag")
        .text(d => `M ${d.mag}`);
}