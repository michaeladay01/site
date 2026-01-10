import os
import base64
import subprocess
import sys

def subset_font(input_file, output_file, glyphs_file):
    # Run the pyftsubset command to subset the font as WOFF2 with size-reducing options
    command = [
        'pyftsubset', input_file,
        '--text-file=' + glyphs_file,
        '--output-file=' + output_file,
        '--flavor=woff2',          # Specify WOFF2 as the output format
        '--no-hinting',            # Remove hinting information
        '--desubroutinize',        # Desubroutinize the font
        '--layout-features=kern,liga'  # Keep only basic kerning and ligatures
    ]
    subprocess.run(command)

def convert_to_base64(font_file):
    # Read the font file and convert it to a Base64 string
    with open(font_file, 'rb') as f:
        font_data = f.read()
        base64_encoded = base64.b64encode(font_data).decode('utf-8')
        return base64_encoded

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <input_otf> <glyphs_file>")
        sys.exit(1)

    input_otf = sys.argv[1]
    glyphs_file = sys.argv[2]

    # Construct the output WOFF2 file name
    output_woff2 = os.path.splitext(os.path.basename(input_otf))[0] + '.woff2'

    # Subset the font
    subset_font(input_otf, output_woff2, glyphs_file)

    # Convert the output font file to Base64
    base64_string = convert_to_base64(output_woff2)

    # Format the Base64 string for CSS
    css_font_face = f"url(data:font/woff2;charset=utf-8;base64,{base64_string}) format('woff2')"

    # Print the formatted CSS string
    print(css_font_face)
