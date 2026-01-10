#!/bin/sh

# Script to process all videos in content/originals/ and generate optimized versions
# This script automatically processes all video files and creates:
# - h264.mp4, h265.mp4, and .webm formats
# - webp poster images from the first frame

# ============================================================================
# INITIALIZATION AND SETUP
# ============================================================================

# Get the absolute path of the script directory
# This ensures the script works regardless of where it's called from
# $(dirname "$0") gets the directory containing this script
# cd to that directory and pwd gets the absolute path
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Define paths relative to the script directory
# ORIGINALS_DIR: Where the source video files are located
ORIGINALS_DIR="$SCRIPT_DIR/content/originals"
# OPTIMIZED_DIR: Where the processed/optimized files will be saved
OPTIMIZED_DIR="$SCRIPT_DIR/content/optimized"
# TRANSCODE_SCRIPT: Path to the transcode.sh script that handles video encoding
TRANSCODE_SCRIPT="$SCRIPT_DIR/transcode.sh"

# Create the optimized directory if it doesn't exist
# -p flag creates parent directories if needed and doesn't error if directory exists
mkdir -p "$OPTIMIZED_DIR"

# Check if the transcode script exists before proceeding
# If it doesn't exist, print an error and exit with status code 1
if [ ! -f "$TRANSCODE_SCRIPT" ]; then
    echo "Error: transcode.sh not found!"
    exit 1
fi

# Make sure the transcode script has execute permissions
# This allows us to run it directly without needing to call it with sh
chmod +x "$TRANSCODE_SCRIPT"

# Export variables so they're available in subshells
# This is needed because we use xargs which runs commands in subshells
# Without export, the variables wouldn't be accessible in those subshells
export ORIGINALS_DIR OPTIMIZED_DIR TRANSCODE_SCRIPT

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Function to get video width using ffprobe
# This extracts the width dimension from the video file's metadata
get_video_width() {
    # Store the input file path in a local variable
    local video_file="$1"
    
    # Use ffprobe to extract video width:
    # -v error: Only show errors, suppress other output
    # -select_streams v:0: Select the first video stream
    # -show_entries stream=width: Show only the width field
    # -of default=noprint_wrappers=1:nokey=1: Output format without wrappers or keys (just the number)
    # 2>/dev/null: Suppress error messages
    # head -1: Take only the first line of output
    ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$video_file" 2>/dev/null | head -1
}

# Function to process a single video file
# This function handles the complete processing pipeline for one video
process_video() {
    # Store the full path to the input video file
    local input_file="$1"
    # Extract just the filename (e.g., "video.mp4" from "/path/to/video.mp4")
    local filename=$(basename "$input_file")
    # Extract the basename without extension (e.g., "video" from "video.mp4")
    local basename="${filename%.*}"
    
    # Skip non-video files (like .png, .txt, etc.)
    # The case statement checks if the filename matches video extensions
    case "$filename" in
        # If it matches any of these video extensions, continue processing
        *.mp4|*.mov|*.avi|*.mkv|*.webm|*.m4v)
            ;;
        # For any other file type, skip it and return from the function
        *)
            echo "Skipping non-video file: $filename"
            return
            ;;
    esac
    
    # ========================================================================
    # CHECK WHICH OPTIMIZED FILES ALREADY EXIST
    # ========================================================================
    
    # Define the expected output file paths for each format
    # These paths will be checked to see if files already exist
    local h264_file="$OPTIMIZED_DIR/${basename}_h264.mp4"
    local h265_file="$OPTIMIZED_DIR/${basename}_h265.mp4"
    local webm_file="$OPTIMIZED_DIR/${basename}.webm"
    local poster_file="$OPTIMIZED_DIR/${basename}-poster.webp"
    
    # Initialize flags to track which files need to be generated
    # Start with all set to true (assume we need to generate everything)
    local needs_h264=true
    local needs_h265=true
    local needs_webm=true
    local needs_poster=true
    
    # Check if each file exists and update the corresponding flag
    # If a file exists, we don't need to generate it
    if [ -f "$h264_file" ]; then
        needs_h264=false
    fi
    if [ -f "$h265_file" ]; then
        needs_h265=false
    fi
    if [ -f "$webm_file" ]; then
        needs_webm=false
    fi
    if [ -f "$poster_file" ]; then
        needs_poster=false
    fi
    
    # Skip processing entirely if all files already exist
    # This saves time by not re-processing videos that are already done
    if [ "$needs_h264" = false ] && [ "$needs_h265" = false ] && [ "$needs_webm" = false ] && [ "$needs_poster" = false ]; then
        echo "Skipping: $filename (already optimized)"
        return
    fi
    
    # ========================================================================
    # DETECT VIDEO WIDTH
    # ========================================================================
    
    echo "Processing: $filename"
    
    # Get the video width using our helper function
    # This width will be used by the transcode script to scale the video appropriately
    local width=$(get_video_width "$input_file")
    
    # Validate the detected width
    # -z checks if the string is empty (detection failed)
    # -lt 100 checks if width is less than 100 pixels (unrealistically small, likely an error)
    if [ -z "$width" ] || [ "$width" -lt 100 ]; then
        # If detection failed or returned invalid value, use a safe default
        echo "  Warning: Could not detect video width, using default 1920px"
        width=1920
    else
        # If detection succeeded, report the detected width
        echo "  Detected video width: ${width}px"
    fi
    
    # ========================================================================
    # GENERATE OPTIMIZED VIDEO FORMATS
    # ========================================================================
    
    # Only generate video formats if at least one is missing
    # The transcode script generates all three formats at once, so we check if any are needed
    if [ "$needs_h264" = true ] || [ "$needs_h265" = true ] || [ "$needs_webm" = true ]; then
        echo "  Generating optimized video formats..."
        
        # Run the transcode script in a subshell
        # We use a subshell (parentheses) so we can change directory without affecting the main script
        (
            # Change to the originals directory
            # This is necessary because transcode.sh expects just the filename, not a full path
            cd "$ORIGINALS_DIR" && \
            # Verify the file exists before trying to process it
            if [ -f "$filename" ]; then
                # Call the transcode script with:
                # 1. The filename (just the name, not full path, since we're in the originals dir)
                # 2. The detected width
                # 3. The output directory (absolute path)
                # </dev/null: Redirect stdin to /dev/null to prevent ffmpeg from reading input
                # This prevents the "Enter command" prompt that causes the script to stall
                "$TRANSCODE_SCRIPT" "$filename" "$width" "$OPTIMIZED_DIR" </dev/null
            else
                # If file doesn't exist, print error and exit the subshell with error code
                echo "  ✗ File not found: $filename"
                exit 1
            fi
        ) || {
            # If the subshell exited with an error (|| catches failures)
            # Print an error message and return from the function with error code
            echo "  ✗ Error processing video formats for: $filename"
            return 1
        }
    else
        # If all video formats already exist, skip this step
        echo "  Skipping video formats (already exist)"
    fi
    
    # ========================================================================
    # GENERATE POSTER IMAGE
    # ========================================================================
    
    # Only generate poster if it doesn't already exist
    if [ "$needs_poster" = true ]; then
        # Define the output path for the final WebP poster
        local poster_path="$OPTIMIZED_DIR/${basename}-poster.webp"
        # Define a temporary PNG file path (we'll convert this to WebP)
        # ${poster_path%.webp} removes .webp extension, then we add .png
        local temp_png="${poster_path%.webp}.png"
        
        echo "  Generating poster: $poster_path"
        
        # Extract the first frame of the video as a PNG image
        # -nostdin: Prevent ffmpeg from reading from stdin (avoids interactive prompts)
        # -i "$input_file": Input video file
        # -vf "select=eq(n\,0)": Video filter that selects frame number 0 (first frame)
        # -frames:v 1: Output only 1 video frame
        # -y: Overwrite output file if it exists (for the temp PNG)
        # </dev/null: Redirect stdin to /dev/null to prevent ffmpeg from reading input
        # 2>/dev/null: Suppress error messages from ffmpeg
        ffmpeg -nostdin -i "$input_file" -vf "select=eq(n\,0)" -frames:v 1 -y "$temp_png" </dev/null 2>/dev/null
        
        # Check if the PNG extraction was successful
        if [ -f "$temp_png" ]; then
            # Convert the PNG to WebP format with high quality
            # -q 85: Quality setting (0-100, where 85 is a good balance of quality vs file size)
            # "$temp_png": Input PNG file
            # -o "$poster_path": Output WebP file
            # 2>/dev/null: Suppress error messages from cwebp
            cwebp -q 85 "$temp_png" -o "$poster_path" 2>/dev/null
            
            # Clean up the temporary PNG file
            # -f flag prevents error if file doesn't exist
            rm -f "$temp_png"
            
            # Verify the WebP conversion was successful
            if [ -f "$poster_path" ]; then
                echo "  ✓ Poster created successfully"
            else
                echo "  ✗ Failed to convert PNG to WebP"
            fi
        else
            # If PNG extraction failed, report the error
            echo "  ✗ Failed to extract first frame"
        fi
    else
        # If poster already exists, skip this step
        echo "  Skipping poster (already exists)"
    fi
    
    # Print completion message for this video
    echo "  ✓ Completed: $filename"
    echo ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Print startup messages to inform user what's happening
echo "Starting video processing..."
echo "Originals directory: $ORIGINALS_DIR"
echo "Output directory: $OPTIMIZED_DIR"
echo ""

# Verify that the originals directory exists before proceeding
# If it doesn't exist, print an error and exit with status code 1
if [ ! -d "$ORIGINALS_DIR" ]; then
    echo "Error: Originals directory not found: $ORIGINALS_DIR"
    exit 1
fi

# Change to the script directory to ensure relative paths work correctly
# || exit 1: If cd fails, exit the script immediately
cd "$SCRIPT_DIR" || exit 1

# ============================================================================
# FIND AND PROCESS ALL VIDEO FILES
# ============================================================================

# Use find with -print0 and while loop for robust path handling
# -print0: Outputs file paths separated by null characters (handles any filename)
# This approach avoids command line length issues and handles paths with spaces/special chars
find "$ORIGINALS_DIR" -type f \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.avi" -o -iname "*.mkv" -o -iname "*.webm" -o -iname "*.m4v" \) -print0 | \
# Read null-delimited input line by line
# IFS=: Don't split on whitespace (preserve spaces in paths)
# read -r: Don't interpret backslashes as escape characters
# -d '': Use null character as delimiter (matches -print0)
while IFS= read -r -d '' video_file; do
    # Check that we got a valid file path (not empty)
    if [ -n "$video_file" ] && [ -f "$video_file" ]; then
        # Call our process_video function with the file path
        process_video "$video_file"
    fi
done

# ============================================================================
# COMPLETION MESSAGE
# ============================================================================

# Print final messages when all processing is complete
echo "All videos processed!"
echo "Optimized files are in: $OPTIMIZED_DIR"
