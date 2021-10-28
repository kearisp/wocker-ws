const parseTable = (string, pos) => {
    return string.split("\n").filter((line) => {
        return line.split(new RegExp("\\s\\s+")).filter((item) => {
            return item !== "";
        }).length > 0;
    }).map((line, index) => {
        if(index === 0) {
            return null;
        }

        let data = line.split(new RegExp("\\s\\s+"));

        let row = {};

        for(let i in data) {
            let name = pos[i];

            row[name] = data[i];
        }

        return row;
    }).filter((line) => {
        return !!line;
    });
};


export {parseTable};