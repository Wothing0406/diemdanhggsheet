"""Convert the supplied class roster to the dashboard's CSV import format."""

import csv
import sys
from pathlib import Path

import openpyxl


def main(source: Path, destination: Path) -> None:
    sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).active
    students = []
    seen = set()
    for row_number, row in enumerate(sheet.iter_rows(values_only=True), 1):
        if row_number < 4 or len(row) < 2 or not isinstance(row[0], (int, float)):
            continue
        if not row[1]:
            continue
        sequence = int(row[0])
        if sequence != len(students) + 1:
            raise ValueError(f"STT at source row {row_number} is {sequence}, expected {len(students) + 1}")
        name = " ".join(" ".join(str(part or "").strip() for part in row[1:3]).split())
        if not name or name.casefold() in seen:
            raise ValueError(f"Missing or duplicate name at source row {row_number}: {name}")
        seen.add(name.casefold())
        students.append(name)
    if not students or len(students) > 500:
        raise ValueError(f"Unexpected student count: {len(students)}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["ma_lop", "ten_lop", "ho_ten"])
        writer.writerows(("12C20", "Lớp 12/20", name) for name in students)
    print(f"Created {destination} with {len(students)} students")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
